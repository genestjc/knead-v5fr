/**
 * Frame sampling is the one piece of the Mux path with logic in it, and the
 * ways it goes wrong are quiet: frames off the end of the recording come back
 * as duplicates of the last one, and a sample that starts at 0 spends a frame
 * on a thumb reaching for the record button.
 *
 * Imported from its own module rather than through anything that constructs a
 * provider client at import time — lib/ai/router.ts builds `new OpenAI()` at
 * module scope and throws without a key, which is why the constants it exports
 * are the only thing pulled in here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { frameTimestamps, frameUrl } from './social-media';

test('frames are spread across the recording, inside both edges', () => {
  const times = frameTimestamps(60, 5);
  assert.equal(times.length, 5);
  assert.ok(times[0] > 0, 'the first frame is not the very first instant');
  assert.ok(times[times.length - 1] < 60, 'the last frame is not the very last instant');
  // Evenly spaced, so a Story sequence is sampled once per card rather than
  // four times in the opening two seconds.
  const gaps = times.slice(1).map((t, i) => Number((t - times[i]).toFixed(2)));
  assert.ok(new Set(gaps).size === 1, `gaps should be uniform, got ${gaps.join(', ')}`);
});

test('every frame lands inside the recording', () => {
  for (const duration of [0.4, 3, 15, 240]) {
    for (const t of frameTimestamps(duration, 8)) {
      assert.ok(t >= 0 && t <= duration, `${t}s is outside a ${duration}s recording`);
    }
  }
});

test('a very short recording still yields distinct frames', () => {
  // The inset is a fraction of the duration, not a flat half-second, or a
  // two-second clip would sample the same instant eight times.
  const times = frameTimestamps(2, 4);
  assert.equal(new Set(times).size, 4);
});

test('one frame is taken from the middle, not the start', () => {
  assert.deepEqual(frameTimestamps(10, 1), [5]);
});

test('a recording with no usable duration falls back to the opening frame', () => {
  assert.deepEqual(frameTimestamps(0, 8), [0]);
  assert.deepEqual(frameTimestamps(Number.NaN, 8), [0]);
});

test('the frame count is clamped to what a provider will accept', () => {
  // Asking for 500 frames is a request that would be rejected by the provider
  // after we had already paid to fetch all 500 stills.
  assert.ok(frameTimestamps(60, 500).length <= 20);
  assert.equal(frameTimestamps(60, 0).length, 1);
});

test('frame URLs carry the timestamp and a bounded width', () => {
  const url = frameUrl('abc123', 12.5);
  assert.match(url, /^https:\/\/image\.mux\.com\/abc123\/thumbnail\.jpg\?/);
  assert.match(url, /time=12\.5/);
  assert.match(url, /width=\d+/);
});
