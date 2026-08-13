/**
 * These cases are the two ways search actually broke for Demeter: sources were
 * dropped whenever Tavily returned an `answer` (so a searched reply carried no
 * attribution and read exactly like a remembered one), and every failure —
 * missing key, HTTP error, empty result set — collapsed into "No results
 * found.", which the model treats as permission to answer from memory.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { webSearch } from './web-search';

const realFetch = globalThis.fetch;
const realKey = process.env.TAVILY_API_KEY;

function stubTavily(response: { ok?: boolean; status?: number; body?: any }) {
  globalThis.fetch = (async () => ({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.body,
  })) as any;
}

/** Captures the body sent to Tavily so the request itself can be asserted on. */
function captureRequest(body: any = { results: [], answer: 'x' }) {
  const sent: any[] = [];
  globalThis.fetch = (async (_url: string, init: any) => {
    sent.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => body } as any;
  }) as any;
  return sent;
}

function restore() {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = realKey;
}

const RESULTS = {
  answer: 'She is opening a second location this fall.',
  results: [
    {
      title: 'Chef opens second location',
      url: 'https://la.eater.com/example',
      content: 'The new room seats forty.',
    },
  ],
};

test('keeps sources even when Tavily returns an answer', async () => {
  process.env.TAVILY_API_KEY = 'test-key';
  stubTavily({ body: RESULTS });
  try {
    const out = await webSearch('chef second location');
    // The regression: the answer used to be returned alone, URLs discarded.
    assert.match(out, /https:\/\/la\.eater\.com\/example/);
    assert.match(out, /Chef opens second location/);
    assert.match(out, /She is opening a second location this fall\./);
    assert.match(out, /name that source/i);
  } finally {
    restore();
  }
});

test('a missing API key tells the model not to answer from memory', async () => {
  delete process.env.TAVILY_API_KEY;
  stubTavily({ body: RESULTS });
  try {
    const out = await webSearch('anything');
    assert.match(out, /WEB SEARCH UNAVAILABLE/);
    assert.match(out, /Do NOT answer from memory/);
  } finally {
    restore();
  }
});

test('an HTTP error is reported as a failed lookup, not as an empty web', async () => {
  process.env.TAVILY_API_KEY = 'test-key';
  stubTavily({ ok: false, status: 429, body: {} });
  try {
    const out = await webSearch('anything');
    assert.match(out, /WEB SEARCH FAILED/);
    assert.match(out, /429/);
    assert.match(out, /Do NOT answer from memory/);
  } finally {
    restore();
  }
});

test('a thrown request is reported as a failed lookup', async () => {
  process.env.TAVILY_API_KEY = 'test-key';
  globalThis.fetch = (async () => {
    throw new Error('socket hang up');
  }) as any;
  try {
    const out = await webSearch('anything');
    assert.match(out, /WEB SEARCH FAILED/);
    assert.match(out, /Do NOT answer from memory/);
  } finally {
    restore();
  }
});

test('a genuinely empty result set is distinguished from a failure', async () => {
  process.env.TAVILY_API_KEY = 'test-key';
  stubTavily({ body: { results: [], answer: '' } });
  try {
    const out = await webSearch('nothing at all');
    assert.match(out, /RETURNED NOTHING/);
    assert.doesNotMatch(out, /FAILED|UNAVAILABLE/);
    assert.match(out, /Do NOT answer from memory/);
  } finally {
    restore();
  }
});

/**
 * The reported miss: asked about Daniel Arsham's trading cards, the agent
 * surfaced a years-old Pokémon collab — better covered, so better ranked — and
 * never mentioned the current Contemporary100 project. Both have to reach the
 * model, dated, with instructions to lead on the recent one and offer the other.
 */
const ARSHAM = {
  answer: 'Daniel Arsham has worked on several trading card projects.',
  results: [
    {
      title: 'Daniel Arsham x Pokémon crossover cards',
      url: 'https://example.com/pokemon',
      content: 'The eroded Pikachu set.',
      published_date: '2023-01-15T00:00:00Z',
    },
    {
      title: 'Daniel Arsham joins Contemporary100',
      url: 'https://example.com/contemporary100',
      content: 'A new card series.',
      published_date: '2026-06-02T00:00:00Z',
    },
  ],
};

test('keeps competing projects from every era, with their dates', async () => {
  process.env.TAVILY_API_KEY = 'test-key';
  stubTavily({ body: ARSHAM });
  try {
    const out = await webSearch('Daniel Arsham trading cards');
    // Both eras reach the model — the older one is context, not a casualty.
    assert.match(out, /Pokémon/);
    assert.match(out, /Contemporary100/);
    assert.match(out, /2023-01-15/);
    assert.match(out, /2026-06-02/);
    // And it is told to lead on the recent one and offer the choice.
    assert.match(out, /NOT by date/);
    assert.match(out, /most recent/i);
    assert.match(out, /ask which they want/i);
  } finally {
    restore();
  }
});

test('undated results are marked as undated rather than left blank', async () => {
  process.env.TAVILY_API_KEY = 'test-key';
  stubTavily({ body: RESULTS });
  try {
    const out = await webSearch('chef second location');
    assert.match(out, /date not given by the source/);
  } finally {
    restore();
  }
});

test('an unparseable date is dropped, never rendered as Invalid Date', async () => {
  process.env.TAVILY_API_KEY = 'test-key';
  stubTavily({
    body: { results: [{ title: 'T', url: 'https://e.com', published_date: 'last tuesday' }] },
  });
  try {
    const out = await webSearch('anything');
    assert.doesNotMatch(out, /Invalid Date/);
    assert.match(out, /date not given by the source/);
  } finally {
    restore();
  }
});

test('recency defaults to unfiltered, so older projects survive the search', async () => {
  process.env.TAVILY_API_KEY = 'test-key';
  const sent = captureRequest();
  try {
    await webSearch('Daniel Arsham trading cards');
    // time_range is a hard filter — sending one by default would have erased
    // the older collaboration before the model ever saw it.
    assert.equal('time_range' in sent[0], false);
  } finally {
    restore();
  }
});

test('an explicit recency window is passed through and disclosed', async () => {
  process.env.TAVILY_API_KEY = 'test-key';
  const sent = captureRequest({ results: [{ title: 'T', url: 'https://e.com' }] });
  try {
    const out = await webSearch('is the pop-up open', { recency: 'week' });
    assert.equal(sent[0].time_range, 'week');
    assert.match(out, /narrowed to the past week/);
  } finally {
    restore();
  }
});

test('an off-enum recency falls back to unfiltered instead of reaching Tavily', async () => {
  process.env.TAVILY_API_KEY = 'test-key';
  const sent = captureRequest();
  try {
    await webSearch('anything', { recency: 'recent' as any });
    assert.equal('time_range' in sent[0], false);
  } finally {
    restore();
  }
});

test('an empty query never reaches the network', async () => {
  process.env.TAVILY_API_KEY = 'test-key';
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return { ok: true, status: 200, json: async () => RESULTS } as any;
  }) as any;
  try {
    const out = await webSearch('   ');
    assert.equal(called, false);
    assert.match(out, /No query was given/);
  } finally {
    restore();
  }
});
