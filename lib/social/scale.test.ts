/**
 * These cases exist because the first version of this console would have told
 * a 300-follower magazine that it was beating Hyperallergic.
 *
 * That claim is arithmetically true on engagement rate and completely
 * worthless: small accounts out-rate large ones structurally, so we would have
 * "led the field" on every platform for exactly as long as we stayed small.
 * A dashboard that flatters you in a way you cannot detect is worse than one
 * that says nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assessComparability,
  renderComparabilityRules,
  MEANINGFUL_GAP_RATIO,
  SMALL_ACCOUNT_FOLLOWERS,
} from './scale';

test('a few hundred followers against a national title is not a comparison', () => {
  const c = assessComparability(312, [340_000, 180_000]);
  assert.equal(c.verdict, 'too-small');
  assert.equal(c.rateIsMeaningful, false, 'this is the flag that gates the whole console');
});

test('the explanation states the instability in this account’s own terms', () => {
  const c = assessComparability(300, [50_000]);
  // "the sample is small" is easy to nod at and ignore. "one like is 0.33
  // points" is not.
  assert.match(c.explanation, /0\.33 points/);
  assert.match(c.explanation, /300 followers/);
});

test('two comparable accounts still get a real comparison', () => {
  const c = assessComparability(40_000, [45_000, 38_000]);
  assert.equal(c.verdict, 'comparable');
  assert.equal(c.rateIsMeaningful, true);
});

test('a large account still loses the comparison across an order of magnitude', () => {
  // Above the small-account floor, so the only problem is the gap itself.
  const c = assessComparability(20_000, [400_000]);
  assert.equal(c.verdict, 'scale-gap');
  assert.equal(c.rateIsMeaningful, false);
  assert.equal(c.gapRatio, 20);
});

test('the gap threshold is a boundary, not a suggestion', () => {
  const atThreshold = assessComparability(
    SMALL_ACCOUNT_FOLLOWERS * 2,
    [SMALL_ACCOUNT_FOLLOWERS * 2 * MEANINGFUL_GAP_RATIO],
  );
  assert.equal(atThreshold.rateIsMeaningful, false, 'exactly 10x is already too far');

  const justInside = assessComparability(SMALL_ACCOUNT_FOLLOWERS * 2, [
    SMALL_ACCOUNT_FOLLOWERS * 2 * (MEANINGFUL_GAP_RATIO - 1),
  ]);
  assert.equal(justInside.rateIsMeaningful, true);
});

test('an unknown follower count is unknown, not comparable', () => {
  const c = assessComparability(null, [100_000]);
  assert.equal(c.verdict, 'unknown');
  assert.equal(c.rateIsMeaningful, false);
  assert.equal(c.gapRatio, null);
});

test('a small account with no competitor data is still flagged as unstable', () => {
  // No field to compare to, but the rate is jumpy on its own terms and must
  // not be read as a measurement.
  const c = assessComparability(300, []);
  assert.equal(c.verdict, 'too-small');
  assert.equal(c.rateIsMeaningful, false);
  assert.equal(c.gapRatio, null);
});

test('the field median is used, so one huge outlier does not decide it', () => {
  const c = assessComparability(30_000, [28_000, 32_000, 5_000_000]);
  assert.equal(c.fieldFollowers, 32_000, 'median, not mean');
  assert.equal(c.rateIsMeaningful, true);
});

test('the agent rules forbid the specific words a model would reach for', () => {
  const rules = renderComparabilityRules([assessComparability(312, [340_000])]);
  for (const word of ['beat', 'lead', 'outperform', 'ahead']) {
    assert.match(rules, new RegExp(word), `the rules must name "${word}" explicitly`);
  }
  // And must redirect to what IS usable at this size.
  assert.match(rules, /SUBJECTS/);
  assert.match(rules, /OUR OWN past/);
});

test('when everything is comparable the rules do not cry wolf', () => {
  const rules = renderComparabilityRules([assessComparability(40_000, [45_000])]);
  assert.doesNotMatch(rules, /MUST NOT/);
  assert.match(rules, /fair comparison/);
});
