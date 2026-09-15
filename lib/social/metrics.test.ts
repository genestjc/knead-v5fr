/**
 * These cases cover the ways a social dashboard lies without anyone noticing:
 * counting an unavailable metric as zero, comparing two accounts on different
 * rulers, ranking by raw count across unequal followings, calling a two-post
 * swing a trend, and folding a paid action into a free-engagement total.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  comparableFields,
  compactNumber,
  engagement,
  engagementRate,
  median,
  movement,
  rankPosts,
  summarizeAccount,
  tagFrequency,
  totalOn,
} from './metrics';
import { EMPTY_METRICS, type SocialMetrics, type SocialPost } from './types';

// `metrics` is omitted from the Partial and re-declared: intersecting
// Partial<SocialPost> with a partial metrics type resolves to the FULL
// SocialMetrics, which would make every case here spell out all nine fields.
function post(
  overrides: Omit<Partial<SocialPost>, 'metrics'> & { metrics?: Partial<SocialMetrics> } = {},
): SocialPost {
  const { metrics, ...rest } = overrides;
  return {
    platform: 'instagram',
    id: Math.random().toString(36).slice(2),
    url: 'https://example.test/p',
    authorHandle: 'knead.mag',
    authorName: 'Knead',
    isOurs: true,
    text: '',
    mediaType: 'image',
    publishedAt: new Date().toISOString(),
    authorFollowers: 1_000,
    tags: [],
    links: [],
    ...rest,
    metrics: { ...EMPTY_METRICS, ...metrics },
  };
}

test('engagement sums only the fields the post reports, and says which', () => {
  const e = engagement({ ...EMPTY_METRICS, likes: 10, comments: 5 });
  assert.equal(e.total, 15);
  assert.deepEqual(e.fields, ['likes', 'comments']);
});

test('a post reporting nothing has null engagement, not zero', () => {
  assert.equal(engagement(EMPTY_METRICS).total, null);
});

test('an unavailable metric is not counted as zero', () => {
  // Same two real numbers; one post's platform also publishes saves. The
  // totals must differ only by the saves that actually exist.
  const withoutSaves = engagement({ ...EMPTY_METRICS, likes: 10, comments: 5 });
  const withSaves = engagement({ ...EMPTY_METRICS, likes: 10, comments: 5, saves: 0 });
  assert.equal(withoutSaves.total, 15);
  assert.equal(withSaves.total, 15);
  assert.equal(withoutSaves.fields.includes('saves'), false);
  assert.equal(withSaves.fields.includes('saves'), true);
});

test('engagement rate is null when the follower count is unknown', () => {
  assert.equal(engagementRate(post({ authorFollowers: null, metrics: { likes: 50 } })), null);
  assert.equal(engagementRate(post({ authorFollowers: 0, metrics: { likes: 50 } })), null);
});

test('engagement rate divides by followers', () => {
  const rate = engagementRate(post({ authorFollowers: 1_000, metrics: { likes: 20, comments: 5 } }));
  assert.equal(rate, 2.5);
});

test('comparableFields is the intersection, so our saves cannot beat their absence', () => {
  const ours = post({ metrics: { likes: 100, comments: 10, saves: 40 } });
  const theirs = post({ isOurs: false, metrics: { likes: 120, comments: 12 } });

  const fields = comparableFields([ours, theirs]);
  assert.deepEqual(fields, ['likes', 'comments']);
  // Without the intersection ours would total 150 against their 132 and
  // "win" on a metric only we have.
  assert.equal(totalOn(ours, fields), 110);
  assert.equal(totalOn(theirs, fields), 132);
});

test('totalOn returns null rather than a partial sum when a field is missing', () => {
  const p = post({ metrics: { likes: 10 } });
  assert.equal(totalOn(p, ['likes', 'saves']), null);
});

test('median is the middle, not the mean — one viral post does not move it', () => {
  assert.equal(median([1, 2, 3, 4, 100]), 3);
  assert.equal(median([2, 4]), 3);
  assert.equal(median([]), null);
});

test('rankPosts puts rate-ranked posts above count-ranked ones', () => {
  const rated = post({ authorFollowers: 1_000, metrics: { likes: 20 } }); // 2%
  const counted = post({ authorFollowers: null, metrics: { likes: 5_000 } });

  const ranked = rankPosts([counted, rated]);
  assert.equal(ranked[0].post.id, rated.id);
  assert.equal(ranked[0].rankedBy, 'rate');
  assert.equal(ranked[1].rankedBy, 'total');
});

test('a big account does not out-rank a small one on rate', () => {
  const small = post({ authorFollowers: 1_000, metrics: { likes: 100 } }); // 10%
  const large = post({ isOurs: false, authorFollowers: 1_000_000, metrics: { likes: 5_000 } }); // 0.5%

  const ranked = rankPosts([large, small]);
  assert.equal(ranked[0].post.id, small.id);
});

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

test('movement refuses to report a percentage on too few posts a side', () => {
  const thin = [
    post({ publishedAt: daysAgo(1), metrics: { likes: 80 } }),
    post({ publishedAt: daysAgo(2), metrics: { likes: 80 } }),
    post({ publishedAt: daysAgo(10), metrics: { likes: 40 } }),
    post({ publishedAt: daysAgo(11), metrics: { likes: 40 } }),
  ];

  const m = movement(thin, 14);
  assert.equal(m.sufficient, false, 'two a side is not enough — one post carries half the median');
  assert.equal(m.changePct, null);
  assert.ok(m.withheldReason, 'and it must say why rather than going quiet');
});

test('movement reports a percentage once both halves are populated enough', () => {
  const posts = [
    ...[1, 2, 3].map((d) => post({ publishedAt: daysAgo(d), metrics: { likes: 100 } })),
    ...[9, 10, 11].map((d) => post({ publishedAt: daysAgo(d), metrics: { likes: 50 } })),
  ];

  const m = movement(posts, 14);
  assert.equal(m.sufficient, true);
  assert.equal(m.changePct, 100);
});

test('a tiny baseline does not get turned into a percentage', () => {
  // The exact case this floor exists for: a median of 4 going to 8 is four
  // more engagements, and "+100%" is indistinguishable in a table from a real
  // doubling of a large account.
  const posts = [
    ...[1, 2, 3].map((d) => post({ publishedAt: daysAgo(d), metrics: { likes: 8 } })),
    ...[9, 10, 11].map((d) => post({ publishedAt: daysAgo(d), metrics: { likes: 4 } })),
  ];

  const m = movement(posts, 14);
  assert.equal(m.sufficient, true, 'there are enough posts — the problem is the size of them');
  assert.equal(m.changePct, null);
  assert.match(m.withheldReason ?? '', /4 → 8/, 'the absolute numbers are given instead');
});

test('the same proportional move IS reported once the baseline is real', () => {
  const posts = [
    ...[1, 2, 3].map((d) => post({ publishedAt: daysAgo(d), metrics: { likes: 200 } })),
    ...[9, 10, 11].map((d) => post({ publishedAt: daysAgo(d), metrics: { likes: 100 } })),
  ];

  const m = movement(posts, 14);
  assert.equal(m.changePct, 100);
  assert.equal(m.withheldReason, null);
});

test('collects stay out of the engagement total', () => {
  const zoraPost = post({ platform: 'zora', metrics: { likes: 4, collects: 200 } });
  assert.equal(engagement(zoraPost.metrics).total, 4);

  const summary = summarizeAccount([zoraPost], 14);
  assert.equal(summary?.medianEngagement, 4);
  assert.equal(summary?.totalCollects, 200, 'reported, but separately');
});

test('summarizeAccount reports cadence per week over the window', () => {
  const posts = Array.from({ length: 6 }, () => post({ metrics: { likes: 10 } }));
  const summary = summarizeAccount(posts, 14);
  assert.equal(summary?.postsPerWeek, 3);
});

test('tagFrequency counts a tag once per post, not once per use', () => {
  const posts = [post({ tags: ['art', 'art', 'food'] }), post({ tags: ['art'] })];
  assert.deepEqual(tagFrequency(posts), [
    { tag: 'art', count: 2 },
    { tag: 'food', count: 1 },
  ]);
});

test('compactNumber renders an unknown as an em dash, never as zero', () => {
  assert.equal(compactNumber(null), '—');
  assert.equal(compactNumber(0), '0');
  assert.equal(compactNumber(12_400), '12.4k');
  assert.equal(compactNumber(2_500_000), '2.5m');
});
