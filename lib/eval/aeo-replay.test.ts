/**
 * Rebuilding a saved audit is the kind of code that fails by producing
 * something plausible. The cases that matter:
 *
 *  - a chart of zeroes rendered as though it were a measurement
 *  - targets coming back in the wrong order, so the field is labelled "ours"
 *  - a run saved before the analyst verdict was stored structurally, losing the
 *    prose people actually read
 *  - an unreachable target read as reachable because nobody stored `ok`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isReplayable, replayAeoRun } from './aeo-replay';
import type { EvalRun, EvalTurn } from './types';

function run(overrides: Partial<EvalRun> = {}): EvalRun {
  return {
    id: 'run-1',
    mode: 'agent',
    surface: 'aeo-story',
    persona: null,
    driverProvider: 'claude',
    driverModel: null,
    title: 'Richard Nadler — ours vs 2',
    notes: null,
    status: 'complete',
    summary: null,
    summaryAuthor: null,
    createdBy: null,
    metadata: { subject: 'Richard Nadler', subjectScore: 58, fieldMedian: 74 },
    createdAt: '',
    completedAt: null,
    ...overrides,
  };
}

let nextIndex = 0;
function turn(metadata: Record<string, any>, over: Partial<EvalTurn> = {}): EvalTurn {
  return {
    id: `t-${nextIndex}`,
    runId: 'run-1',
    turnIndex: nextIndex++,
    role: 'event',
    content: '',
    latencyMs: 120,
    metadata,
    createdAt: '',
    ...over,
  };
}

function fetchTurn(over: Record<string, any> = {}) {
  return turn({
    url: 'https://kneadmag.com/posts/nadler',
    finalUrl: 'https://kneadmag.com/posts/nadler',
    status: 200,
    score: 58,
    isOurs: true,
    visibleWords: 900,
    quotedPassages: 4,
    specificityMarkers: 12,
    coverage: {
      inTitle: true,
      inDescription: false,
      inSchemaAbout: false,
      inOpening: true,
      mentions: 7,
      matchedFullName: true,
    },
    checks: [
      { id: 'subject-in-title', label: 'Named in the title', status: 'pass', detail: 'x', weight: 3 },
      { id: 'seo-title-length', label: 'Title fits', status: 'warn', detail: '72 chars', weight: 2 },
    ],
    ...over,
  });
}

test('a saved run rebuilds its targets in audit order, ours first', () => {
  nextIndex = 0;
  const turns = [
    fetchTurn(),
    turn({ isOurs: true, score: 58 }, { role: 'agent', content: 'report' }),
    fetchTurn({
      url: 'https://hyperallergic.com/nadler',
      finalUrl: 'https://hyperallergic.com/nadler',
      score: 81,
      isOurs: false,
    }),
  ];

  const replayed = replayAeoRun(run(), turns);
  assert.equal(replayed.signals.length, 2, 'only fetch turns become targets');
  assert.match(replayed.signals[0].url, /kneadmag/, 'ours is index 0 — the charts rely on it');
  assert.match(replayed.signals[1].url, /hyperallergic/);
  assert.equal(replayed.subject, 'Richard Nadler');
  assert.equal(replayed.subjectScore, 58);
  assert.equal(replayed.fieldMedian, 74);
  assert.ok(replayed.complete);
});

test('turns are ordered by index, not by the order they came back in', () => {
  nextIndex = 0;
  const ours = fetchTurn();
  const theirs = fetchTurn({ url: 'https://hyperallergic.com/nadler', isOurs: false, score: 81 });
  // Rows can come back from Postgres in any order without an ORDER BY upstream.
  const replayed = replayAeoRun(run(), [theirs, ours]);
  assert.match(replayed.signals[0].url, /kneadmag/);
});

test('the checks survive with their status and weight', () => {
  nextIndex = 0;
  const replayed = replayAeoRun(run(), [fetchTurn()]);
  const checks = replayed.signals[0].checks;
  assert.equal(checks.length, 2);
  assert.equal(checks[0].status, 'pass');
  assert.equal(checks[1].id, 'seo-title-length', 'the SEO rows the matrix splits on are kept');
  assert.equal(checks[1].weight, 2);
});

test('a malformed check row is dropped rather than rendered as an unnamed pass', () => {
  nextIndex = 0;
  const replayed = replayAeoRun(run(), [
    fetchTurn({
      checks: [
        { id: 'real', label: 'Real', status: 'pass', detail: 'x', weight: 1 },
        { label: 'no id at all', status: 'pass' },
        { id: 'odd-status', label: 'Odd', status: 'banana', detail: '', weight: 1 },
      ],
    }),
  ]);
  const checks = replayed.signals[0].checks;
  assert.equal(checks.length, 2, 'the row with no id is dropped');
  assert.equal(checks[1].status, 'na', 'an unrecognised status abstains rather than passing');
});

test('coverage comes back whole, with absent keys defaulted rather than undefined', () => {
  nextIndex = 0;
  const replayed = replayAeoRun(run(), [fetchTurn({ coverage: { inTitle: true, mentions: 3 } })]);
  const coverage = replayed.signals[0].coverage;
  assert.equal(coverage.inTitle, true);
  assert.equal(coverage.mentions, 3);
  // The table renders a dot per key; undefined would render as a silent fail.
  assert.equal(coverage.inDescription, false);
  assert.equal(coverage.matchedFullName, false);
});

test('an unreachable target is not read as reachable', () => {
  nextIndex = 0;
  // `ok` was never stored, so it has to be derived — and deriving it wrong
  // means an unreachable competitor appears in the scoreboard as a real zero.
  const replayed = replayAeoRun(run(), [
    fetchTurn({ status: null, error: 'Timed out after 15000ms', checks: [] }),
  ]);
  assert.equal(replayed.signals[0].ok, false);
  assert.equal(replayed.signals[0].error, 'Timed out after 15000ms');
});

test('a 404 is reachable-but-failed, not ok', () => {
  nextIndex = 0;
  const replayed = replayAeoRun(run(), [fetchTurn({ status: 404 })]);
  assert.equal(replayed.signals[0].ok, false);
});

test('the extraction diagnosis survives, because it is the finding most often misread', () => {
  nextIndex = 0;
  const replayed = replayAeoRun(run(), [
    fetchTurn({
      extractionFailed: true,
      extractionDiagnosis: 'Only 13 words reached the extracted text while 94% sits inside <script>.',
      visibleWords: 13,
    }),
  ]);
  assert.equal(replayed.signals[0].extractionFailed, true);
  assert.match(replayed.signals[0].extractionDiagnosis ?? '', /94%/);
});

// ─── the analyst ────────────────────────────────────────────────────────────

test('the analyst panel rebuilds from stored fields', () => {
  nextIndex = 0;
  const turns = [
    fetchTurn(),
    turn(
      {
        analyst: true,
        model: 'claude-opus-4-8',
        verdict: 'They quote the daughter; we quote the press release.',
        advantages: [{ url: 'https://hyperallergic.com/nadler', advantage: 'original quote' }],
        recommendations: [{ priority: 'high', change: 'call the estate' }],
      },
      { role: 'agent', content: 'ANALYST (claude-opus-4-8)\n\n…' },
    ),
  ];

  const replayed = replayAeoRun(run(), turns);
  assert.match(replayed.analysis?.verdict ?? '', /daughter/);
  assert.equal(replayed.analysis?.advantages.length, 1);
  assert.equal(replayed.analysis?.recommendations.length, 1);
  assert.equal(replayed.analystText, null, 'no fallback needed when the verdict was stored');
});

test('a run saved before the verdict was stored keeps the analyst prose', () => {
  nextIndex = 0;
  const turns = [
    fetchTurn(),
    turn(
      { analyst: true, model: 'claude-opus-4-8', advantages: [], recommendations: [] },
      { role: 'agent', content: 'ANALYST (claude-opus-4-8)\n\nThey quote the daughter.' },
    ),
  ];

  const replayed = replayAeoRun(run(), turns);
  assert.equal(replayed.analysis?.verdict, '');
  assert.match(
    replayed.analystText ?? '',
    /quote the daughter/,
    'the prose is shown rather than dropped — it is the part a person reads',
  );
});

test('a skipped or failed analyst pass is reported, not silently absent', () => {
  nextIndex = 0;
  const turns = [
    fetchTurn(),
    turn({ analystError: 'rate limited' }, { role: 'system', content: 'Analyst pass failed' }),
  ];
  const replayed = replayAeoRun(run(), turns);
  assert.equal(replayed.analysis, null);
  assert.match(replayed.analystError ?? '', /rate limited/);
});

// ─── partial rebuilds ───────────────────────────────────────────────────────

test('a run with no fetch turns is not reported as a complete rebuild', () => {
  nextIndex = 0;
  const replayed = replayAeoRun(run(), [turn({ comparison: true }, { role: 'event' })]);
  assert.equal(replayed.signals.length, 0);
  assert.equal(replayed.complete, false, 'an empty chart must never look like a measurement');
});

test('a reachable target whose checks were never stored marks the rebuild partial', () => {
  nextIndex = 0;
  const replayed = replayAeoRun(run(), [fetchTurn({ checks: [] })]);
  assert.equal(replayed.complete, false);
});

test('only the AEO surfaces are replayable', () => {
  assert.equal(isReplayable(run({ surface: 'aeo-story' })), true);
  assert.equal(isReplayable(run({ surface: 'aeo-audit' })), true);
  assert.equal(isReplayable(run({ surface: 'social-audit' })), false);
  assert.equal(isReplayable(run({ surface: 'article-agent' })), false);
});
