/**
 * The sizing math, where the failures are quiet:
 *
 *  - a small image upscaled into a blurrier version of itself that costs more
 *    to send than the original
 *  - a panorama whose short edge rounds to zero, producing a canvas nothing can
 *    be drawn on
 *  - base64 padding counted as payload, so a size check refuses a file that fits
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { base64Bytes, fitWithin, formatBytes, MAX_IMAGE_EDGE } from './image-fit';

test('a phone screenshot is fitted to the long edge, aspect preserved', () => {
  // iPhone 15 Pro, portrait.
  const fitted = fitWithin(1290, 2796);
  assert.equal(fitted.height, MAX_IMAGE_EDGE);
  assert.equal(fitted.width, Math.round(1290 * (MAX_IMAGE_EDGE / 2796)));
  // Aspect ratio survives to within a rounded pixel.
  assert.ok(Math.abs(fitted.width / fitted.height - 1290 / 2796) < 0.001);
});

test('a landscape screenshot is bounded on its width', () => {
  const fitted = fitWithin(3840, 2160);
  assert.equal(fitted.width, MAX_IMAGE_EDGE);
  assert.equal(fitted.height, Math.round(2160 * (MAX_IMAGE_EDGE / 3840)));
});

test('an image already under the bound is left alone, never enlarged', () => {
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
  assert.deepEqual(fitWithin(MAX_IMAGE_EDGE, 100), { width: MAX_IMAGE_EDGE, height: 100 });
});

test('a long thread capture keeps at least one pixel on its short edge', () => {
  // A full-height capture of a comment thread is extremely tall and narrow.
  const fitted = fitWithin(400, 40_000);
  assert.equal(fitted.height, MAX_IMAGE_EDGE);
  assert.ok(fitted.width >= 1, 'a zero width is a canvas nothing can be drawn on');
});

test('an undecodable image is returned unchanged rather than divided by zero', () => {
  assert.deepEqual(fitWithin(0, 0), { width: 0, height: 0 });
  assert.deepEqual(fitWithin(Number.NaN, 100), { width: Number.NaN, height: 100 });
});

test('base64 padding is not counted as payload', () => {
  // "abc" -> "YWJj" (no padding), "ab" -> "YWI=", "a" -> "YQ=="
  assert.equal(base64Bytes('YWJj'), 3);
  assert.equal(base64Bytes('YWI='), 2);
  assert.equal(base64Bytes('YQ=='), 1);
  assert.equal(base64Bytes(''), 0);
});

test('sizes are formatted the way a person would say them', () => {
  assert.equal(formatBytes(2_400_000), '2.4MB');
  assert.equal(formatBytes(870_000), '870KB');
});
