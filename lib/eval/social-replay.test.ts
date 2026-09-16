/**
 * Rebuilding a saved social audit. The failures worth catching are the ones
 * that produce a page that looks right:
 *
 *  - a competitor missing from the rebuild, which is the exact symptom the
 *    whole surface was reported broken for
 *  - the model's verdict shown where a human had overridden it, which defeats
 *    the point of the override
 *  - a score carried over from storage rather than recomputed, so an override
 *    changes the verdict but not the number beside it
 *  - a run that failed before the judge replied drawing an empty scoreboard
 *    that reads as a measurement of zero
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { replaySocialRun } from './social-replay';
import { OUR_POST_ID, theirPostId } from './social-judge';
import type { EvalCriterion, EvalResult, EvalRun, EvalTurn } from './types';

function criterion(id: string, over: Partial<EvalCriterion> = {}): EvalCriterion {
  return {
    id,
    surface: 'social-audit',
    prompt: `Does it ${id}?`,
    guidance: '',
    expectedVerdict: 'pass',
    weight: 1,
    platform: null,
    sortOrder: 0,
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

const CRITERIA = [criterion('a'), criterion('b')];

function result(over: Partial<EvalResult> = {}): EvalResult {
  return {
    id: `r-${Math.random()}`,
    runId: 'run-1',
    criterionId: 'a',
    verdict: 'pass',
    judgedBy: 'claude',
    judgeModel: 'claude-opus-4-8',
    rationale: 'because',
    evidence: 'a quote',
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

let idx = 0;
function turn(metadata: Record<string, any>, content = ''): EvalTurn {
  return {
    id: `t-${idx}`,
    runId: 'run-1',
    turnIndex: idx++,
    role: 'agent',
    content,
    latencyMs: null,
    metadata,
    createdAt: '',
  };
}

function run(over: Partial<EvalRun> = {}): EvalRun {
  return {
    id: 'run-1',
    mode: 'agent',
    surface: 'social-audit',
    persona: null,
    driverProvider: 'claude',
    driverModel: null,
    title: 'Instagram — Nadler vs 1',
    notes: null,
    status: 'complete',
    summary: 'a summary',
    summaryAuthor: 'claude',
    createdBy: null,
    metadata: { platform: 'instagram', subject: 'Richard Nadler' },
    createdAt: '',
    completedAt: null,
    ...over,
  };
}

/** A complete two-post audit, as the route writes it. */
function savedTurns() {
  idx = 0;
  return [
    turn({ platform: 'instagram' }, 'EVIDENCE'),
    turn({
      postId: OUR_POST_ID,
      label: 'Knead',
      isOurs: true,
      score: 50,
      verdict: 'Ours opens on us.',
      extracted: { text: 'We sat down with', comments: '', handle: 'knead.mag' },
      model: 'claude-opus-4-8',
    }),
    turn({
      postId: theirPostId(0),
      label: 'Hyperallergic',
      isOurs: false,
      score: 100,
      verdict: 'Theirs opens on the date.',
      extracted: { text: 'In 1998 the gallery closed', comments: '', handle: 'hyperallergic' },
      model: 'claude-opus-4-8',
      scores: [
        { criterionId: 'a', verdict: 'pass', rationale: 'x', evidence: 'the 1998 closure' },
        { criterionId: 'b', verdict: 'pass', rationale: 'x', evidence: 'the 1998 closure' },
      ],
    }),
    turn({
      model: 'claude-opus-4-8',
      scoreboard: [
        { postId: OUR_POST_ID, label: 'Knead', isOurs: true, score: 50 },
        { postId: theirPostId(0), label: 'Hyperallergic', isOurs: false, score: 100 },
      ],
      comparison: { leaderId: theirPostId(0), summary: 'They front-load the fact.', toClose: ['open on the date'] },
      differences: [{ dimension: 'content', difference: 'theirs leads with the date', advantage: 'theirs' }],
      recommendations: [{ priority: 'high', change: 'open on the closure date', rationale: 'x', effort: 'rewrite' }],
      sentiment: null,
    }),
  ];
}

test('both posts come back, ours first', () => {
  // The symptom the whole surface was reported broken for: the competitor
  // missing from the result entirely.
  const replayed = replaySocialRun(run(), savedTurns(), CRITERIA);
  assert.ok(replayed);
  assert.deepEqual(
    replayed!.judgement.posts.map((p) => p.label),
    ['Knead', 'Hyperallergic'],
  );
  assert.deepEqual(
    replayed!.judgement.posts.map((p) => p.isOurs),
    [true, false],
  );
  assert.equal(replayed!.complete, true);
});

test("the competitor's own verdicts and score are rebuilt", () => {
  const replayed = replaySocialRun(run(), savedTurns(), CRITERIA);
  const theirs = replayed!.judgement.posts[1];
  assert.equal(theirs.scores.length, 2);
  assert.equal(theirs.score, 100);
  assert.match(theirs.verdict, /opens on the date/);
  assert.match(theirs.extracted.text, /In 1998/);
});

test('the comparison, dimensions and recommendations survive', () => {
  const replayed = replaySocialRun(run(), savedTurns(), CRITERIA);
  assert.equal(replayed!.judgement.comparison?.leaderId, theirPostId(0));
  assert.match(replayed!.judgement.comparison?.summary ?? '', /front-load/);
  assert.deepEqual(replayed!.judgement.comparison?.toClose, ['open on the date']);
  assert.equal(replayed!.judgement.differences.length, 1);
  assert.equal(replayed!.judgement.recommendations.length, 1);
  assert.equal(replayed!.judgement.model, 'claude-opus-4-8');
});

test('our verdicts come from eval_results, so a human override is what shows', () => {
  // The model failed row 'a'; a person overrode it to pass. Showing the model's
  // verdict here would make the override pointless.
  const replayed = replaySocialRun(
    run({
      results: [
        result({ criterionId: 'a', verdict: 'fail', judgedBy: 'claude' }),
        result({ criterionId: 'a', verdict: 'pass', judgedBy: 'human', rationale: 'it does' }),
        result({ criterionId: 'b', verdict: 'pass', judgedBy: 'claude' }),
      ],
    }),
    savedTurns(),
    CRITERIA,
  );

  const ours = replayed!.judgement.posts[0];
  const a = ours.scores.find((s) => s.criterionId === 'a');
  assert.equal(a?.verdict, 'pass', "the human's verdict wins");
  assert.equal(ours.scores.length, 2, 'one row per criterion, not one per grader');
});

test('our score is recomputed from the verdicts, not carried over', () => {
  // Stored score was 50. With the override both rows pass, so the number beside
  // the verdicts has to move with them.
  const replayed = replaySocialRun(
    run({
      results: [
        result({ criterionId: 'a', verdict: 'fail', judgedBy: 'claude' }),
        result({ criterionId: 'a', verdict: 'pass', judgedBy: 'human' }),
        result({ criterionId: 'b', verdict: 'pass', judgedBy: 'claude' }),
      ],
    }),
    savedTurns(),
    CRITERIA,
  );
  assert.equal(replayed!.judgement.posts[0].score, 100);
});

test('a post whose turn was never written still appears, and marks the rebuild partial', () => {
  // The scoreboard is the roster. Dropping a post from the comparison it was
  // part of is how a competitor disappears without anyone noticing.
  const turns = savedTurns().filter((t) => t.metadata.postId !== theirPostId(0));
  const replayed = replaySocialRun(run(), turns, CRITERIA);
  assert.equal(replayed!.judgement.posts.length, 2);
  assert.equal(replayed!.judgement.posts[1].label, 'Hyperallergic');
  assert.equal(replayed!.complete, false);
});

test('warnings are carried back so a dropped competitor is still reported', () => {
  idx = 0;
  const turns = [
    ...savedTurns(),
    turn({ warnings: ['Hyperallergic was left out of this audit: no screenshot reached the server.'] }),
  ];
  const replayed = replaySocialRun(run(), turns, CRITERIA);
  assert.match(replayed!.judgement.warnings[0], /left out of this audit/);
});

test('a run that never got a judgement rebuilds nothing rather than an empty chart', () => {
  idx = 0;
  const replayed = replaySocialRun(
    run({ status: 'failed', summary: 'the judge timed out' }),
    [turn({ platform: 'instagram' }, 'EVIDENCE')],
    CRITERIA,
  );
  assert.equal(replayed, null, 'an empty scoreboard would read as a measurement of zero');
});

test('only social-audit runs are rebuilt here', () => {
  assert.equal(replaySocialRun(run({ surface: 'aeo-story' }), savedTurns(), CRITERIA), null);
});

test('a verdict stored only in the turn body is still recovered', () => {
  // Runs saved before the verdict became a field. The body is a header line,
  // then the verdict, then the extracted text.
  idx = 0;
  const turns = [
    turn({
      postId: OUR_POST_ID,
      label: 'Knead',
      isOurs: true,
      score: 50,
      extracted: { text: '', comments: '', handle: null },
    }, 'Knead (ours) — 50/100\n\nOurs opens on us.\n\nCAPTION AS READ:\nWe sat down with'),
  ];
  const replayed = replaySocialRun(run(), turns, CRITERIA);
  assert.equal(replayed!.judgement.posts[0].verdict, 'Ours opens on us.');
});
