/**
 * The case this covers is the in-app browser one: a reader on Instagram whose
 * WebView is torn down between turns. The thread has to come back, and it has
 * to come back even when storage is partitioned, throwing, or full — because
 * the alternative the reader sees is Demeter saying it can't remember.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  loadThread,
  saveThread,
  threadKey,
  __clearThreadMemory,
  THREAD_TTL_MS,
  MAX_STORED_MESSAGES,
} from './demeter-thread';

/** Minimal localStorage, with hooks for the ways in-app WebViews break it. */
function installStorage(opts: { throwOnGet?: boolean; throwOnSet?: boolean } = {}) {
  const map = new Map<string, string>();
  const store = {
    getItem(k: string) {
      if (opts.throwOnGet) throw new Error('SecurityError: storage is partitioned');
      return map.has(k) ? map.get(k)! : null;
    },
    setItem(k: string, v: string) {
      if (opts.throwOnSet) throw new Error('QuotaExceededError');
      map.set(k, v);
    },
    removeItem(k: string) {
      map.delete(k);
    },
  };
  (globalThis as any).window = { localStorage: store };
  return map;
}

function removeStorage() {
  delete (globalThis as any).window;
}

const thread = [
  { role: 'user' as const, content: 'Who is the chef?' },
  { role: 'assistant' as const, content: 'Her name is Nadia.' },
];

beforeEach(() => {
  __clearThreadMemory();
  removeStorage();
});

test('a saved thread survives a remount — the in-app WebView case', () => {
  installStorage();
  saveThread('the-story', thread);
  // A remount loses React state and the module map; storage is all that's left.
  __clearThreadMemory();
  assert.deepEqual(loadThread('the-story'), thread);
});

test('threads are kept per article', () => {
  installStorage();
  saveThread('story-a', thread);
  assert.deepEqual(loadThread('story-b'), []);
  assert.notEqual(threadKey('story-a'), threadKey('story-b'));
});

test('a thread survives even when storage writes throw', () => {
  installStorage({ throwOnSet: true });
  saveThread('the-story', thread);
  // localStorage never took it, so the in-memory layer is the one answering.
  assert.deepEqual(loadThread('the-story'), thread);
});

test('a storage read that throws degrades to an empty thread, not a crash', () => {
  installStorage({ throwOnGet: true });
  assert.deepEqual(loadThread('the-story'), []);
});

test('works with no storage at all (SSR / storage stripped)', () => {
  removeStorage();
  assert.deepEqual(loadThread('the-story'), []);
  saveThread('the-story', thread);
  assert.deepEqual(loadThread('the-story'), thread);
});

test('corrupt stored data is ignored', () => {
  const map = installStorage();
  map.set(threadKey('the-story'), 'not json{');
  assert.deepEqual(loadThread('the-story'), []);

  map.set(threadKey('the-story'), JSON.stringify({ savedAt: Date.now(), messages: 'nope' }));
  __clearThreadMemory();
  assert.deepEqual(loadThread('the-story'), []);
});

test('malformed messages are filtered out, valid ones kept', () => {
  const map = installStorage();
  map.set(
    threadKey('the-story'),
    JSON.stringify({
      savedAt: Date.now(),
      messages: [thread[0], { role: 'system', content: 'x' }, { role: 'user' }, thread[1]],
    }),
  );
  assert.deepEqual(loadThread('the-story'), thread);
});

test('a stale thread does not resurface', () => {
  const map = installStorage();
  map.set(
    threadKey('the-story'),
    JSON.stringify({ savedAt: Date.now() - THREAD_TTL_MS - 1000, messages: thread }),
  );
  assert.deepEqual(loadThread('the-story'), []);
});

test('long threads are capped so storage cannot grow without bound', () => {
  installStorage();
  const long = Array.from({ length: MAX_STORED_MESSAGES + 10 }, (_, i) => ({
    role: 'user' as const,
    content: `message ${i}`,
  }));
  saveThread('the-story', long);
  __clearThreadMemory();
  const restored = loadThread('the-story');
  assert.equal(restored.length, MAX_STORED_MESSAGES);
  // The cap keeps the most RECENT turns — the ones a follow-up resolves against.
  assert.equal(restored[restored.length - 1].content, `message ${long.length - 1}`);
});
