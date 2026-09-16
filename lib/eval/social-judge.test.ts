/**
 * The scoring, parsing and budgeting are where a visual LLM-as-judge quietly
 * produces a result that looks fine and isn't. These cases cover the specific
 * ways:
 *
 *  - an inverted criterion scored backwards, so bait-free posts lose points
 *  - "na" counted as a failure, punishing a post for a question the material
 *    never gave the judge a way to answer
 *  - a verdict with no quote behind it, which is an opinion wearing a verdict's
 *    clothes
 *  - a verdict against a criterion id nobody sent, or the same one twice
 *  - one side's screen recording eating the whole image budget, leaving a
 *    confidently written comparison of our post against nothing
 *  - a rubric row for another platform being graded anyway
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  budgetImages,
  criteriaFor,
  describeImages,
  OUR_POST_ID,
  oursOf,
  parseSocialJudgement,
  renderSocialSummary,
  rosterFor,
  theirPostId,
  type PostRoster,
  type SocialSubmission,
} from './social-judge';
import { weightedScore, type EvalCriterion } from './types';

function criterion(overrides: Partial<EvalCriterion> = {}): EvalCriterion {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    surface: 'social-audit',
    prompt: 'Does the opening line carry a specific fact?',
    guidance: '',
    expectedVerdict: 'pass',
    weight: 1,
    platform: null,
    sortOrder: 0,
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function score(criterionId: string, verdict: 'pass' | 'fail' | 'na') {
  return { criterionId, verdict, rationale: 'because', evidence: 'a quote' };
}

/** Ours alone, unless competitors are named. */
function roster(...theirLabels: string[]): PostRoster[] {
  return [
    { id: OUR_POST_ID, label: 'Knead', isOurs: true },
    ...theirLabels.map((label, i) => ({ id: theirPostId(i), label, isOurs: false })),
  ];
}

/** The judge's reply, wrapping one post's scores in the per-post envelope. */
function reply(body: {
  posts?: any[];
  differences?: any[];
  comparison?: any;
  sentiment?: any;
  recommendations?: any[];
}) {
  return JSON.stringify(body);
}

/** Shorthand for a single-post reply, which most parsing cases are. */
function ourReply(block: Record<string, unknown>) {
  return reply({ posts: [{ postId: OUR_POST_ID, ...block }] });
}

// ─── scoring ────────────────────────────────────────────────────────────────

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
  // The submission was caption-only, so the image criterion could not be
  // judged. Scoring it a failure would punish the post for what we did not send.
  assert.equal(weightedScore([score('a', 'pass'), score('image', 'na')], c), 100);
});

test('a post where nothing could be judged has no score, not zero', () => {
  const c = [criterion({ id: 'a' })];
  assert.equal(weightedScore([score('a', 'na')], c), null);
  assert.equal(weightedScore([], c), null);
});

test('a weight the database never set still counts as one', () => {
  // A row read from a database that has not run migration 016 comes back
  // without the column; treating it as weight 0 would drop it from the total.
  const c = [criterion({ id: 'a', weight: undefined as unknown as number })];
  assert.equal(weightedScore([score('a', 'pass')], c), 100);
});

// ─── which rows apply ───────────────────────────────────────────────────────

test('rows scoped to another platform are not asked', () => {
  const rows = [
    criterion({ id: 'universal' }),
    criterion({ id: 'ig', platform: 'instagram' }),
    criterion({ id: 'li', platform: 'linkedin' }),
  ];
  const applied = criteriaFor(rows, 'instagram').map((c) => c.id);
  assert.deepEqual(applied, ['universal', 'ig']);
});

test('inactive rows and rows from other surfaces are left out', () => {
  const rows = [
    criterion({ id: 'live' }),
    criterion({ id: 'archived', isActive: false }),
    criterion({ id: 'elsewhere', surface: 'aeo-audit' }),
  ];
  assert.deepEqual(
    criteriaFor(rows, 'x').map((c) => c.id),
    ['live'],
  );
});

// ─── every submission is graded ─────────────────────────────────────────────

function submission(label: string): SocialSubmission {
  return { label, text: 'a caption' };
}

test('every submitted post reaches the roster, exactly once', () => {
  // THE BUG THIS GUARDS. The route collected competitors in full — validated
  // their images, resolved their Mux assets, sampled their frames, wrote them
  // into the run metadata — and then called the judge without them. Every audit
  // came back solo, and every feature built on top of a competitor was correct
  // code that could never fire.
  const list = rosterFor(submission('Knead'), [
    submission('Hyperallergic'),
    submission('Colossal'),
  ]);

  assert.equal(list.length, 3, 'ours plus both competitors');
  assert.deepEqual(
    list.map((r) => r.label),
    ['Knead', 'Hyperallergic', 'Colossal'],
  );
  assert.deepEqual(
    list.map((r) => r.isOurs),
    [true, false, false],
  );
  assert.equal(new Set(list.map((r) => r.id)).size, 3, 'ids are unique');
  assert.equal(list[0].id, OUR_POST_ID);
});

test('a competitor with no label still gets a name to be reported under', () => {
  const list = rosterFor(submission('Knead'), [{ label: '', text: 'x' }]);
  assert.equal(list[1].label, 'Competitor 1');
});

test('with no competitors the roster is just ours', () => {
  const list = rosterFor(submission('Knead'), []);
  assert.deepEqual(list.map((r) => r.id), [OUR_POST_ID]);
});

// ─── parsing ────────────────────────────────────────────────────────────────

test('a verdict with no evidence is downgraded, not counted', () => {
  const c = [criterion({ id: 'a' }), criterion({ id: 'b' })];
  const parsed = parseSocialJudgement(
    ourReply({
      verdict: 'Fine.',
      scores: [
        { criterionId: 'a', verdict: 'pass', rationale: 'it does', evidence: 'the 1998 closure' },
        { criterionId: 'b', verdict: 'pass', rationale: 'trust me', evidence: '' },
      ],
    }),
    c,
    roster(),
  );

  const ours = oursOf(parsed)!;
  const b = ours.scores.find((s) => s.criterionId === 'b');
  assert.equal(b?.verdict, 'na', 'an unevidenced verdict is an opinion');
  assert.match(b?.rationale ?? '', /Downgraded/);
  assert.equal(ours.score, 100, 'and it is excluded rather than dragging the score');
  assert.ok(parsed.warnings.some((w) => /without a supporting quote/.test(w)));
});

test('a verdict against an unknown criterion id is discarded', () => {
  const parsed = parseSocialJudgement(
    ourReply({
      scores: [
        { criterionId: 'real', verdict: 'pass', rationale: 'x', evidence: 'q' },
        { criterionId: 'invented', verdict: 'fail', rationale: 'x', evidence: 'q' },
      ],
    }),
    [criterion({ id: 'real' })],
    roster(),
  );
  assert.equal(oursOf(parsed)!.scores.length, 1);
  assert.equal(oursOf(parsed)!.scores[0].criterionId, 'real');
});

test('a repeated criterion is deduped rather than double-counted', () => {
  const c = [criterion({ id: 'a' }), criterion({ id: 'b' })];
  const parsed = parseSocialJudgement(
    ourReply({
      scores: [
        { criterionId: 'a', verdict: 'fail', rationale: 'x', evidence: 'q' },
        { criterionId: 'a', verdict: 'pass', rationale: 'x', evidence: 'q' },
        { criterionId: 'b', verdict: 'pass', rationale: 'x', evidence: 'q' },
      ],
    }),
    c,
    roster(),
  );
  assert.equal(oursOf(parsed)!.scores.length, 2, 'last write wins');
  assert.equal(oursOf(parsed)!.score, 100);
});

test('missing criteria are reported rather than silently unscored', () => {
  const c = [criterion({ id: 'a' }), criterion({ id: 'b' }), criterion({ id: 'c' })];
  const parsed = parseSocialJudgement(
    ourReply({ scores: [{ criterionId: 'a', verdict: 'pass', rationale: 'x', evidence: 'q' }] }),
    c,
    roster(),
  );
  assert.ok(parsed.warnings.some((w) => /2 of 3 criteria were not returned/.test(w)));
});

test('an unparseable reply keeps the prose instead of reporting an empty judgement', () => {
  const parsed = parseSocialJudgement(
    'The caption is weak but I could not format it.',
    [criterion()],
    roster(),
  );
  assert.match(oursOf(parsed)!.verdict, /caption is weak/);
  assert.ok(parsed.parseError);
  assert.equal(oursOf(parsed)!.score, null);
});

// ─── every post is graded, not just ours ────────────────────────────────────

test('each post is scored separately, in roster order', () => {
  const c = [criterion({ id: 'a' })];
  const parsed = parseSocialJudgement(
    reply({
      posts: [
        // Deliberately out of order: the roster decides how they are presented,
        // not the order the model happened to emit them in.
        {
          postId: theirPostId(0),
          verdict: 'Theirs leads on the fact.',
          scores: [{ criterionId: 'a', verdict: 'pass', rationale: 'x', evidence: 'the 1998 date' }],
        },
        {
          postId: OUR_POST_ID,
          verdict: 'Ours opens on us.',
          scores: [{ criterionId: 'a', verdict: 'fail', rationale: 'x', evidence: 'We sat down' }],
        },
      ],
    }),
    c,
    roster('Hyperallergic'),
  );

  assert.deepEqual(
    parsed.posts.map((p) => p.label),
    ['Knead', 'Hyperallergic'],
  );
  assert.equal(parsed.posts[0].score, 0, 'ours failed the only row');
  assert.equal(parsed.posts[1].score, 100, 'theirs passed it');
  assert.equal(oursOf(parsed)!.postId, OUR_POST_ID);
});

test("a competitor's verdicts never land on our post", () => {
  // The failure this guards is invisible in the UI and wrong in the database:
  // a block against an id nobody sent must not be attached to anything.
  const parsed = parseSocialJudgement(
    reply({
      posts: [
        {
          postId: OUR_POST_ID,
          scores: [{ criterionId: 'a', verdict: 'fail', rationale: 'x', evidence: 'q' }],
        },
        {
          postId: 'theirs-9',
          scores: [{ criterionId: 'a', verdict: 'pass', rationale: 'x', evidence: 'q' }],
        },
      ],
    }),
    [criterion({ id: 'a' })],
    roster(),
  );

  assert.equal(parsed.posts.length, 1, 'only the roster decides how many posts there are');
  assert.equal(oursOf(parsed)!.score, 0, 'ours keeps its own failing verdict');
  assert.ok(parsed.warnings.some((w) => /never sent/.test(w)));
});

test('a post the judge skipped is reported rather than passed off as unscored', () => {
  const parsed = parseSocialJudgement(
    reply({
      posts: [
        {
          postId: OUR_POST_ID,
          scores: [{ criterionId: 'a', verdict: 'pass', rationale: 'x', evidence: 'q' }],
        },
      ],
    }),
    [criterion({ id: 'a' })],
    roster('Hyperallergic'),
  );

  assert.equal(parsed.posts.length, 2, 'the skipped post still appears');
  assert.equal(parsed.posts[1].score, null, 'with no score, rather than a zero');
  assert.ok(parsed.warnings.some((w) => /Hyperallergic was not graded/.test(w)));
});

// ─── the head-to-head ───────────────────────────────────────────────────────

test('the comparison names a leader from the roster', () => {
  const parsed = parseSocialJudgement(
    reply({
      posts: [],
      comparison: {
        leaderId: theirPostId(0),
        summary: 'Theirs front-loads the date.',
        toClose: ['open on the closure date'],
      },
    }),
    [],
    roster('Hyperallergic'),
  );
  assert.equal(parsed.comparison?.leaderId, theirPostId(0));
  assert.deepEqual(parsed.comparison?.toClose, ['open on the closure date']);
});

test('a leader naming a post nobody sent is dropped rather than rendered as a winner', () => {
  const parsed = parseSocialJudgement(
    reply({ posts: [], comparison: { leaderId: 'theirs-7', summary: 'x' } }),
    [],
    roster('Hyperallergic'),
  );
  assert.equal(parsed.comparison?.leaderId, null);
  assert.equal(parsed.comparison?.summary, 'x', 'the reasoning survives');
});

test('there is no head-to-head when only our post was submitted', () => {
  const parsed = parseSocialJudgement(
    reply({ posts: [], comparison: { leaderId: OUR_POST_ID, summary: 'we win' } }),
    [],
    roster(),
  );
  assert.equal(parsed.comparison, null, 'a field of one has no head-to-head');
});

test('the four dimensions come back in a fixed order, one each', () => {
  const parsed = parseSocialJudgement(
    reply({
      differences: [
        { dimension: 'delivery', difference: 'theirs front-loads', advantage: 'theirs' },
        { dimension: 'style', difference: 'ours is flatter', advantage: 'theirs' },
        // A second read of the same dimension is the judge restating itself.
        { dimension: 'style', difference: 'ours is flatter, restated', advantage: 'theirs' },
        { dimension: 'invented', difference: 'not a dimension', advantage: 'ours' },
      ],
    }),
    [],
    roster('Hyperallergic'),
  );
  assert.deepEqual(
    parsed.differences.map((d) => d.dimension),
    ['style', 'delivery'],
    'canonical order, unknown dimensions dropped',
  );
  assert.equal(parsed.differences[0].difference, 'ours is flatter, restated');
});

test('a difference with no actual difference stated is dropped', () => {
  const parsed = parseSocialJudgement(
    reply({ differences: [{ dimension: 'tone', ours: 'dry', theirs: 'warm', difference: '' }] }),
    [],
    roster('Hyperallergic'),
  );
  assert.equal(parsed.differences.length, 0);
});

test('sentiment survives with its quotes attached', () => {
  const parsed = parseSocialJudgement(
    reply({
      sentiment: {
        summary: 'Mostly supportive.',
        positiveShare: 70,
        themes: [{ theme: 'people want the address', valence: 'neutral', quote: 'where is this?' }],
        flags: ['two people asked for the address and got no reply'],
      },
    }),
    [],
    roster(),
  );
  assert.equal(parsed.sentiment?.positiveShare, 70);
  assert.equal(parsed.sentiment?.themes[0].quote, 'where is this?');
  assert.equal(parsed.sentiment?.flags.length, 1);
});

// ─── the summary ────────────────────────────────────────────────────────────

test("the summary names the rows that fell short, in the rubric's own words", () => {
  const c = [criterion({ id: 'a', prompt: 'Does the opening carry a fact?' })];
  const parsed = parseSocialJudgement(
    ourReply({
      verdict: 'Thin.',
      scores: [
        { criterionId: 'a', verdict: 'fail', rationale: 'it opens on us', evidence: 'We sat down with' },
      ],
    }),
    c,
    roster(),
  );
  const summary = renderSocialSummary(parsed, c);
  assert.match(summary, /Does the opening carry a fact\?/);
  assert.match(summary, /We sat down with/);
  assert.match(summary, /0\/100 weighted/);
});

test('a solo audit is not numbered as one of three', () => {
  // With nothing to compare against there is no "2" and no "3", so presenting
  // our post as step one of three would promise two sections that never come.
  const c = [criterion({ id: 'a' })];
  const parsed = parseSocialJudgement(
    ourReply({ verdict: 'Ours.', scores: [{ criterionId: 'a', verdict: 'pass', rationale: 'x', evidence: 'q' }] }),
    c,
    roster(),
  );
  const summary = renderSocialSummary(parsed, c);
  assert.match(summary, /^OUR POST/);
  assert.doesNotMatch(summary, /CROSS-COMPARISON/);
  assert.doesNotMatch(summary, /1 · /);
});

test('the summary runs ours, theirs, then the cross-comparison', () => {
  const c = [criterion({ id: 'a' })];
  const parsed = parseSocialJudgement(
    reply({
      posts: [
        {
          postId: OUR_POST_ID,
          verdict: 'Ours opens on us.',
          scores: [{ criterionId: 'a', verdict: 'fail', rationale: 'x', evidence: 'q' }],
        },
        {
          postId: theirPostId(0),
          verdict: 'Theirs opens on the date.',
          scores: [{ criterionId: 'a', verdict: 'pass', rationale: 'x', evidence: 'q' }],
        },
      ],
      comparison: {
        leaderId: theirPostId(0),
        summary: 'They front-load the fact.',
        toClose: ['open on the closure date'],
      },
    }),
    c,
    roster('Hyperallergic'),
  );

  const summary = renderSocialSummary(parsed, c);

  // The three analyses, in the order the reasoning runs in: each post graded on
  // its own evidence before anything is said about which is stronger.
  const ourIdx = summary.indexOf('1 · OUR POST');
  const theirIdx = summary.indexOf('2 · THEIR POST');
  const crossIdx = summary.indexOf('3 · CROSS-COMPARISON');
  assert.ok(ourIdx >= 0 && theirIdx > ourIdx && crossIdx > theirIdx, summary);

  assert.match(summary, /STRONGEST: Hyperallergic/);
  assert.match(summary, /They front-load the fact\./);
  assert.match(summary, /open on the closure date/);

  // The scoreboard ranks by score, not by whose post it is: theirs scored 100
  // and ours 0, so theirs is the first row under the cross-comparison heading.
  const board = summary.slice(crossIdx);
  assert.ok(
    board.indexOf('Hyperallergic') < board.indexOf('← OURS'),
    'the field is ranked by score, not by ownership',
  );
});

// ─── image budget ───────────────────────────────────────────────────────────

test('everything is sent when it all fits', () => {
  assert.deepEqual(budgetImages(4, [3, 2], 20), { ours: 4, theirs: [3, 2] });
});

test('one side cannot eat the whole budget', () => {
  // Twenty frames of our own recording against a competitor screenshot would
  // otherwise leave the comparison with nothing of theirs to compare against.
  const budget = budgetImages(20, [6], 20);
  assert.ok(budget.ours < 20, 'ours is trimmed');
  assert.ok(budget.theirs[0] > 0, 'theirs still gets frames');
  assert.equal(budget.ours + budget.theirs[0], 20, 'and the budget is spent, not wasted');
});

test('competitors share what is left round-robin, not first-come', () => {
  const budget = budgetImages(10, [8, 8, 8], 20);
  assert.equal(budget.ours, 10);
  assert.deepEqual(budget.theirs, [4, 3, 3], 'no competitor is left with nothing');
  assert.equal(budget.theirs.reduce((a, b) => a + b, 0), 10);
});

test('an unused half is handed to the other side rather than wasted', () => {
  // Their two screenshots do not need ten slots, so our recording keeps the
  // rest instead of the run being capped at twelve images out of twenty.
  const budget = budgetImages(30, [2], 20);
  assert.deepEqual(budget, { ours: 18, theirs: [2] });
});

test('with no competitor, our post may use the whole budget', () => {
  assert.deepEqual(budgetImages(30, [], 20), { ours: 20, theirs: [] });
});

test('no side is ever budgeted more than it has', () => {
  const budget = budgetImages(3, [1, 1], 20);
  assert.equal(budget.ours, 3);
  assert.deepEqual(budget.theirs, [1, 1]);
});

// ─── describing what was attached ────────────────────────────────────────────

test('frames and screenshots in one submission are told apart', () => {
  // Someone films the Story sequence AND screenshots the comment thread. Calling
  // all five frames would tell the model the comment screenshot is the end of
  // the sequence.
  const described = describeImages(5, [0.5, 4, 7.5]);
  assert.match(described, /first 3 image\(s\) are FRAMES/);
  assert.match(described, /0\.5s, 4s, 7\.5s/);
  assert.match(described, /remaining 2 image\(s\) are SCREENSHOT/);
});

test('screenshots alone are not described as a sequence', () => {
  const described = describeImages(2, []);
  assert.doesNotMatch(described, /FRAMES|sequence, /);
  assert.match(described, /2 image\(s\) are SCREENSHOT/);
});

test('frames alone are all described as frames', () => {
  const described = describeImages(3, [1, 2, 3]);
  assert.match(described, /first 3 image\(s\) are FRAMES/);
  assert.doesNotMatch(described, /SCREENSHOT/);
});

test('more timestamps than images does not invent images', () => {
  // The budget trimmed the frames after the timestamps were computed.
  const described = describeImages(2, [1, 2, 3, 4]);
  assert.match(described, /first 2 image\(s\) are FRAMES/);
  assert.doesNotMatch(described, /SCREENSHOT/);
});
