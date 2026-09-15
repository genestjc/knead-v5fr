/**
 * Subject matching decides which posts end up in a head-to-head, so a bad
 * match is not a cosmetic problem — it puts an unrelated post on the
 * scoreboard, or drops the competitor post the whole comparison was about.
 *
 * The cases here are the two failures that actually occur: substring matches
 * ("art" inside "artist") and shortened names (a caption that says "Nadler"
 * after the headline said "Richard Nadler").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { occurrences, postsAboutSubject, postsLinkingToSlug, splitBySubject, subjectMatcher } from './subjects';
import { EMPTY_METRICS, type SocialPost } from './types';

function post(text: string, overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    platform: 'x',
    id: Math.random().toString(36).slice(2),
    url: 'https://example.test/p',
    authorHandle: 'kneadmag',
    authorName: null,
    isOurs: true,
    text,
    mediaType: 'text',
    publishedAt: new Date().toISOString(),
    metrics: { ...EMPTY_METRICS },
    authorFollowers: 1_000,
    tags: [],
    links: [],
    ...overrides,
  };
}

test('occurrences matches whole words only', () => {
  assert.equal(occurrences('the artist is an artist', 'art'), 0);
  assert.equal(occurrences('the art is art', 'art'), 2);
});

test('a surname on its own counts as a mention', () => {
  const m = subjectMatcher('Richard Nadler');
  assert.equal(m.matches('Nadler reopened the studio this week.'), true);
  assert.equal(m.matches('Richard has a new show.'), true);
});

test('the full-name check is separate from the mention check', () => {
  const m = subjectMatcher('Richard Nadler');
  assert.equal(m.matchedFull('Nadler reopened the studio.'), false);
  assert.equal(m.matchedFull('Richard Nadler reopened the studio.'), true);
});

test('a hashtag counts as a mention', () => {
  const m = subjectMatcher('Richard Nadler');
  assert.equal(m.matches('New work up now #richardnadler'), true);
});

test('short connective words are not used as match candidates', () => {
  // "of" and "the" would otherwise match essentially any post.
  const m = subjectMatcher('The Museum of Modern Art');
  assert.equal(m.matches('We went to the shop and bought a hat.'), false);
  assert.equal(m.matches('Museum hours have changed.'), true);
});

test('postsAboutSubject searches tags and links, not just body text', () => {
  const posts = [
    post('New work up now', { tags: ['nadler'] }),
    post('Link in bio', { links: ['https://kneadmag.com/posts/richard-nadler-studio'] }),
    post('A completely unrelated post about bread.'),
  ];
  assert.equal(postsAboutSubject(posts, 'Nadler').length, 2);
});

test('splitBySubject reports a subject we did not cover rather than an empty result', () => {
  const posts = [
    post('Nadler reopens', { isOurs: false, authorHandle: 'hyperallergic' }),
    post('Something else entirely'),
  ];
  const split = splitBySubject(posts, 'Nadler');
  assert.equal(split.ours.length, 0);
  assert.equal(split.theirs.length, 1, 'their coverage survives so the gap is visible');
});

test('postsLinkingToSlug matches a story through UTM parameters', () => {
  const posts = [
    post('Read it', { links: ['https://kneadmag.com/posts/bread-week?utm_source=x'] }),
    post('Different story', { links: ['https://kneadmag.com/posts/other-thing'] }),
  ];
  const matched = postsLinkingToSlug(posts, 'bread-week');
  assert.equal(matched.length, 1);
});
