/**
 * The scoring and parsing are where an LLM-as-judge quietly produces a number
 * that looks fine and isn't. These cases cover the specific ways:
 *
 *  - an inverted criterion scored backwards, so bait-free posts lose points
 *  - "na" counted as a failure, punishing a post for a question it was never
 *    given the material to answer
 *  - a verdict with no quote behind it, which is an opinion wearing a verdict's
 *    clothes
 *  - a verdict against a criterion id nobody sent
 *  - the same criterion returned twice and double-counted
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseJudgement } from './parse';
import { weightedScore, type CriterionScore, type JudgeCriterion } from './types';

function criterion(overrides: Partial<JudgeCriterion> = {}): JudgeCriterion {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    platform: null,
    prompt: 'Does the opening line carry a specific fact?',
    guidance: '',
    expectedVerdict: 'pass',
    weight: 1,
    sortOrder: 0,
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function score(criterionId: string, verdict: CriterionScore['verdict']): CriterionScore {
  return { criterionId, verdict, rationale: 'because', evidence: 'a quote' };
}

test('a passing post scores 100', () => {
  const c = [criterion({ id: 'a' }), criterion({ id: 'b' })];
  assert.equal(weightedScore([score('a', 'pass'), score('b', 'pass')], c), 100);
});

test('weight actually weights', () => {
  const c = [criterion({ id: 'heavy', weight: 3 }), criterion({ id: 'light', weight: 1 })];
  // Failing the weight-3 row costs three quarters of the score, not half.
  assert.equal(weightedScore([score('heavy', 'fail'), score('light', 'pass')], c), 25);
  assert.equal(weightedScore([score('heavy', 'pass'), score('light', 'fail')], c), 75);
});

test('an inverted criterion is scored on its own polarity', () => {
  // "Does the caption use engagement bait?" — answering "fail" (it does not)
  // is the GOOD outcome and must earn the points.
  const c = [criterion({ id: 'bait', expectedVerdict: 'fail' })];
  assert.equal(weightedScore([score('bait', 'fail')], c), 100, 'no bait is a pass');
  assert.equal(weightedScore([score('bait', 'pass')], c), 0, 'bait present is a failure');
});

test('na is excluded from the score rather than counted as a failure', () => {
  const c = [criterion({ id: 'a' }), criterion({ id: 'image' })];
  // The post was caption-only, so the image criterion could not be judged.
  // Scoring it as a failure would punish the post for what we did not send.
  assert.equal(weightedScore([score('a', 'pass'), score('image', 'na')], c), 100);
});

test('a post where nothing could be judged has no score, not zero', () => {
  const c = [criterion({ id: 'a' })];
  assert.equal(weightedScore([score('a', 'na')], c), null);
  assert.equal(weightedScore([], c), null);
});

test('a verdict with no evidence is downgraded, not counted', () => {
  const c = [criterion({ id: 'a' }), criterion({ id: 'b' })];
  const raw = JSON.stringify({
    verdict: 'Fine.',
    scores: [
      { criterionId: 'a', verdict: 'pass', rationale: 'it does', evidence: 'the 1998 closure' },
      { criterionId: 'b', verdict: 'pass', rationale: 'trust me', evidence: '' },
    ],
  });

  const parsed = parseJudgement(raw, c);
  const b = parsed.scores.find((s) => s.criterionId === 'b');
  assert.equal(b?.verdict, 'na', 'an unevidenced verdict is an opinion');
  assert.match(b?.rationale ?? '', /Downgraded/);
  assert.equal(parsed.score, 100, 'and it is excluded rather than dragging the score');
  assert.ok(parsed.warnings.some((w) => /without a supporting quote/.test(w)));
});

test('a verdict against an unknown criterion id is discarded', () => {
  const c = [criterion({ id: 'real' })];
  const raw = JSON.stringify({
    scores: [
      { criterionId: 'real', verdict: 'pass', rationale: 'x', evidence: 'q' },
      { criterionId: 'invented', verdict: 'fail', rationale: 'x', evidence: 'q' },
    ],
  });

  const parsed = parseJudgement(raw, c);
  assert.equal(parsed.scores.length, 1);
  assert.equal(parsed.scores[0].criterionId, 'real');
});

test('a repeated criterion is deduped rather than double-counted', () => {
  const c = [criterion({ id: 'a' }), criterion({ id: 'b' })];
  const raw = JSON.stringify({
    scores: [
      { criterionId: 'a', verdict: 'fail', rationale: 'x', evidence: 'q' },
      { criterionId: 'a', verdict: 'pass', rationale: 'x', evidence: 'q' },
      { criterionId: 'b', verdict: 'pass', rationale: 'x', evidence: 'q' },
    ],
  });

  const parsed = parseJudgement(raw, c);
  assert.equal(parsed.scores.length, 2, 'last write wins');
  assert.equal(parsed.score, 100);
});

test('missing criteria are reported rather than silently unscored', () => {
  const c = [criterion({ id: 'a' }), criterion({ id: 'b' }), criterion({ id: 'c' })];
  const raw = JSON.stringify({
    scores: [{ criterionId: 'a', verdict: 'pass', rationale: 'x', evidence: 'q' }],
  });

  const parsed = parseJudgement(raw, c);
  assert.ok(parsed.warnings.some((w) => /2 of 3 criteria were not returned/.test(w)));
});

test('an unparseable reply keeps the prose instead of reporting an empty judgement', () => {
  const parsed = parseJudgement('The caption is weak but I could not format it.', [criterion()]);
  assert.match(parsed.verdict, /caption is weak/);
  assert.ok(parsed.parseError);
  assert.equal(parsed.score, null);
});

test('comparison is dropped when the judge returns none', () => {
  const parsed = parseJudgement(JSON.stringify({ verdict: 'x', scores: [], comparison: null }), []);
  assert.equal(parsed.comparison, null);
});

test('sentiment survives with its quotes attached', () => {
  const raw = JSON.stringify({
    verdict: 'x',
    scores: [],
    sentiment: {
      summary: 'Mostly supportive.',
      positiveShare: 70,
      themes: [{ theme: 'people want the address', valence: 'neutral', quote: 'where is this?' }],
      flags: ['two people asked for the address and got no reply'],
    },
  });

  const parsed = parseJudgement(raw, []);
  assert.equal(parsed.sentiment?.positiveShare, 70);
  assert.equal(parsed.sentiment?.themes[0].quote, 'where is this?');
  assert.equal(parsed.sentiment?.flags.length, 1);
});
