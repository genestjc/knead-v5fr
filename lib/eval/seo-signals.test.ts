/**
 * The SEO extractor reads pages nobody on this team wrote, so the cases that
 * matter are the ones where sloppy markup produces a confident wrong number:
 *
 *  - alt="" counted as a missing alt, which pushes someone to write alt text
 *    for a spacer gif
 *  - a canonical with a tracking parameter read as pointing somewhere else
 *  - #fragment, mailto: and javascript: hrefs counted as internal links
 *  - protocol-relative and root-relative hrefs counted as external
 *  - a heading level going back UP read as a skipped level
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { altTextShare, readSeoSignals, skippedHeadingLevels } from './seo-signals';

function read(html: string, overrides: Partial<Parameters<typeof readSeoSignals>[0]> = {}) {
  return readSeoSignals({
    html,
    finalUrl: 'https://kneadmag.com/posts/richard-nadler-retrospective',
    title: null,
    metaDescription: null,
    canonical: null,
    ...overrides,
  });
}

// ─── headings ───────────────────────────────────────────────────────────────

test('headings are read in document order, with their levels', () => {
  const seo = read('<h1>The Lede</h1><h2>One</h2><h3>Deeper</h3><h2>Two</h2>');
  assert.deepEqual(seo.headingLevels, [1, 2, 3, 2]);
  assert.deepEqual(seo.h1s, ['The Lede']);
  assert.equal(seo.h2Count, 2);
});

test('markup inside a heading is stripped rather than counted as text', () => {
  const seo = read('<h1 class="x"><span>Richard</span> <em>Nadler</em></h1>');
  assert.deepEqual(seo.h1s, ['Richard Nadler']);
});

test('two H1s are reported as two, not collapsed', () => {
  const seo = read('<h1>Site name</h1><h1>The headline</h1>');
  assert.equal(seo.h1s.length, 2);
});

test('going back up the hierarchy is a new section, not a skipped level', () => {
  assert.deepEqual(skippedHeadingLevels([1, 2, 3, 2, 3, 2]), []);
  assert.deepEqual(skippedHeadingLevels([1, 2, 4]), [4], 'h2 straight to h4 is a skip');
  assert.deepEqual(skippedHeadingLevels([2, 5]), [5]);
  assert.deepEqual(skippedHeadingLevels([]), []);
});

// ─── links ──────────────────────────────────────────────────────────────────

test('relative and root-relative links count as internal', () => {
  const seo = read(
    '<a href="/posts/another">a</a><a href="../archive">b</a><a href="https://kneadmag.com/about">c</a>',
  );
  assert.equal(seo.internalLinks, 3);
  assert.equal(seo.externalLinks, 0);
});

test('non-navigation hrefs are not links to anywhere', () => {
  const seo = read(
    '<a href="#top">x</a><a href="mailto:hi@kneadmag.com">y</a><a href="javascript:void(0)">z</a><a href="tel:+15551234">t</a>',
  );
  assert.equal(seo.internalLinks, 0);
  assert.equal(seo.externalLinks, 0);
});

test('a link to another origin is external', () => {
  const seo = read('<a href="https://hyperallergic.com/piece">them</a>');
  assert.equal(seo.externalLinks, 1);
  assert.equal(seo.internalLinks, 0);
});

// ─── images ─────────────────────────────────────────────────────────────────

test('alt="" is decorative, not a missing alt', () => {
  const seo = read('<img src="a.jpg" alt="A hand-lettered closing sign"><img src="spacer.gif" alt="">');
  assert.equal(seo.images, 2);
  assert.equal(seo.imagesWithAlt, 1);
  assert.equal(seo.imagesDecorative, 1);
  // The decorative one is excluded from both halves rather than dragging the
  // share down for being marked up correctly.
  assert.equal(altTextShare(seo), 1);
});

test('an image with no alt attribute at all counts against the share', () => {
  const seo = read('<img src="a.jpg" alt="described"><img src="b.jpg">');
  assert.equal(altTextShare(seo), 0.5);
});

test('a page of only decorative images has no share to report, not a zero', () => {
  const seo = read('<img src="a.gif" alt=""><img src="b.gif" alt="">');
  assert.equal(altTextShare(seo), null, 'null is "nothing to judge", 0 would be "all missing"');
});

test('a page with no images has no share to report', () => {
  assert.equal(altTextShare(read('<p>words</p>')), null);
});

// ─── canonical ──────────────────────────────────────────────────────────────

test('a canonical carrying a tracking parameter still points at this page', () => {
  const seo = read('', {
    canonical: 'https://kneadmag.com/posts/richard-nadler-retrospective?utm_source=newsletter',
  });
  assert.equal(seo.canonicalSelfReferential, true);
});

test('a trailing slash is not a different page', () => {
  const seo = read('', { canonical: 'https://kneadmag.com/posts/richard-nadler-retrospective/' });
  assert.equal(seo.canonicalSelfReferential, true);
});

test('a canonical pointing at another page is reported as such', () => {
  const seo = read('', { canonical: 'https://kneadmag.com/posts/something-else' });
  assert.equal(seo.canonicalSelfReferential, false);
});

test('a relative canonical resolves against the page URL', () => {
  const seo = read('', { canonical: '/posts/richard-nadler-retrospective' });
  assert.equal(seo.canonicalSelfReferential, true);
});

// ─── head declarations ──────────────────────────────────────────────────────

test('open graph tags are found in either attribute order', () => {
  const seo = read(
    '<meta property="og:title" content="A headline">' +
      '<meta content="A description" property="og:description">',
  );
  assert.equal(seo.hasOgTitle, true);
  assert.equal(seo.hasOgDescription, true);
  assert.equal(seo.hasOgImage, false);
});

test('an og tag with an empty content attribute does not count as present', () => {
  // A framework emitting <meta property="og:image" content=""> looks like
  // markup and behaves like nothing.
  const seo = read('<meta property="og:image" content="">');
  assert.equal(seo.hasOgImage, false);
});

test('noindex is read out of the robots meta', () => {
  assert.equal(read('<meta name="robots" content="noindex, follow">').noindex, true);
  assert.equal(read('<meta name="robots" content="index, follow">').noindex, false);
  assert.equal(read('<p>no robots meta</p>').noindex, false);
});

// ─── slug ───────────────────────────────────────────────────────────────────

test('the slug is split into words for the subject check', () => {
  assert.deepEqual(read('').slugWords, ['richard', 'nadler', 'retrospective']);
});

test('a file extension is not a slug word', () => {
  const seo = read('', { finalUrl: 'https://example.com/news/closing-night.html' });
  assert.deepEqual(seo.slugWords, ['closing', 'night']);
});

test('a bare origin has no slug', () => {
  assert.deepEqual(read('', { finalUrl: 'https://kneadmag.com/' }).slugWords, []);
});

// ─── lengths ────────────────────────────────────────────────────────────────

test('title and description lengths are measured trimmed', () => {
  const seo = read('', { title: '  Richard Nadler, 1931–2024  ', metaDescription: ' Short. ' });
  assert.equal(seo.titleLength, 'Richard Nadler, 1931–2024'.length);
  assert.equal(seo.descriptionLength, 'Short.'.length);
});
