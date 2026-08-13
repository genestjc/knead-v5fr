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
