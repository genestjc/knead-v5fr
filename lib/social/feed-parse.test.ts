/**
 * Real feeds are messier than the specs. These cases are the shapes that
 * actually break a naive reader: Atom putting the link in an attribute and
 * carrying a self-link first, CDATA around titles, namespaced date elements,
 * and unescaped ampersands.
 *
 * The failure that matters most is the Atom self-link one — taking the first
 * <link> gives every item in the feed the same URL, pointing at the feed, and
 * nothing downstream can tell that happened.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cleanText, decodeEntities, discoverFeedUrl, parseFeed } from './feed-parse';

const RSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Hyperallergic</title>
    <item>
      <title><![CDATA[A Studio Fire & What Came After]]></title>
      <link>https://hyperallergic.com/1/studio-fire</link>
      <pubDate>Tue, 09 Sep 2026 14:02:00 +0000</pubDate>
      <description><![CDATA[<p>The gallery reopened in <em>June</em>.</p>]]></description>
      <category>Art</category>
      <category>Reviews</category>
    </item>
    <item>
      <title>Second piece</title>
      <link>https://hyperallergic.com/2/second</link>
      <pubDate>Mon, 08 Sep 2026 09:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>It's Nice That</title>
  <link rel="self" href="https://itsnicethat.com/feed.xml"/>
  <entry>
    <title>Type design in 2026</title>
    <link rel="self" href="https://itsnicethat.com/feed.xml"/>
    <link rel="alternate" href="https://itsnicethat.com/articles/type-2026"/>
    <published>2026-09-10T08:30:00Z</published>
    <summary>A survey of new releases.</summary>
    <category term="graphic-design"/>
  </entry>
</feed>`;

test('reads an RSS 2.0 feed', () => {
  const feed = parseFeed(RSS);
  assert.equal(feed.title, 'Hyperallergic');
  assert.equal(feed.items.length, 2);
  assert.equal(feed.items[0].url, 'https://hyperallergic.com/1/studio-fire');
});

test('CDATA and entities survive the trip', () => {
  const feed = parseFeed(RSS);
  assert.equal(feed.items[0].title, 'A Studio Fire & What Came After');
  assert.equal(feed.items[0].summary, 'The gallery reopened in June .');
});

test('the channel title is not taken from the first item', () => {
  // The head is split off before entries are scanned; without that, "A Studio
  // Fire" becomes the publication name.
  assert.equal(parseFeed(RSS).title, 'Hyperallergic');
});

test('Atom links come from the alternate, never the self-link', () => {
  const feed = parseFeed(ATOM);
  assert.equal(
    feed.items[0].url,
    'https://itsnicethat.com/articles/type-2026',
    'taking the first <link> would point every item at the feed itself',
  );
});

test('Atom categories are read from the term attribute', () => {
  assert.deepEqual(parseFeed(ATOM).items[0].categories, ['graphic-design']);
});

test('RSS categories are read from the element body', () => {
  assert.deepEqual(parseFeed(RSS).items[0].categories, ['Art', 'Reviews']);
});

test('dates become ISO strings, and an unparseable one is null not epoch', () => {
  const feed = parseFeed(RSS);
  assert.match(feed.items[0].publishedAt ?? '', /^2026-09-09T14:02:00/);

  const undated = parseFeed(
    `<rss><channel><item><title>x</title><link>https://e.test/x</link><pubDate>whenever</pubDate></item></channel></rss>`,
  );
  assert.equal(undated.items[0].publishedAt, null);
});

test('a future-dated entry is clamped rather than sorting above everything forever', () => {
  const future = new Date(Date.now() + 400 * 86_400_000).toUTCString();
  const feed = parseFeed(
    `<rss><channel><item><title>x</title><link>https://e.test/x</link><pubDate>${future}</pubDate></item></channel></rss>`,
  );
  const parsed = Date.parse(feed.items[0].publishedAt ?? '');
  assert.ok(parsed <= Date.now() + 1000, 'a publishing-system bug is not news');
});

test('an entry with neither title nor link is skipped, not emitted blank', () => {
  const feed = parseFeed(`<rss><channel><item><pubDate>Tue, 09 Sep 2026 14:02:00 +0000</pubDate></item></channel></rss>`);
  assert.equal(feed.items.length, 0);
});

test('a guid is used as the link when it is a URL', () => {
  const feed = parseFeed(
    `<rss><channel><item><title>x</title><guid>https://e.test/real</guid></item></channel></rss>`,
  );
  assert.equal(feed.items[0].url, 'https://e.test/real');
});

test('a non-URL guid is not mistaken for a link', () => {
  const feed = parseFeed(
    `<rss><channel><item><title>x</title><guid>abc-123-def</guid></item></channel></rss>`,
  );
  assert.equal(feed.items[0].url, '');
});

test('namespaced date elements are read', () => {
  const feed = parseFeed(
    `<rdf:RDF><item><title>x</title><link>https://e.test/x</link><dc:date>2026-09-01T00:00:00Z</dc:date></item></rdf:RDF>`,
  );
  assert.match(feed.items[0].publishedAt ?? '', /^2026-09-01/);
});

test('garbage in does not throw', () => {
  for (const input of ['', '   ', 'not xml at all', '<rss><channel>', '<<<>>>']) {
    assert.doesNotThrow(() => parseFeed(input));
  }
});

test('the ampersand is decoded last', () => {
  // Decoding & first would turn &amp;lt; into a literal <, which is not what
  // the feed said.
  assert.equal(decodeEntities('&amp;lt;b&amp;gt;'), '&lt;b&gt;');
  assert.equal(decodeEntities('Q&amp;A'), 'Q&A');
});

test('cleanText strips markup without gluing words together', () => {
  assert.equal(cleanText('<p>one</p><p>two</p>'), 'one two');
});

test('feed discovery reads what the page advertises', () => {
  const html = `<html><head>
    <link rel="stylesheet" href="/a.css">
    <link rel="alternate" type="application/rss+xml" href="/feed.xml">
  </head></html>`;
  assert.equal(discoverFeedUrl(html, 'https://example.test/about'), 'https://example.test/feed.xml');
});

test('feed discovery ignores a stylesheet and returns null when nothing is declared', () => {
  assert.equal(discoverFeedUrl('<html><head><link rel="stylesheet" href="/a.css"></head></html>', 'https://e.test'), null);
});
