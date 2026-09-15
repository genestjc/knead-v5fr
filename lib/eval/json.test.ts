/**
 * The rule these cases protect: an unparseable model reply is never silently
 * turned into an empty result. An empty sentiment report reads as "nobody said
 * anything" and an empty trend report reads as "nothing is happening" — both
 * are claims about the world, and neither one happened.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { arrayOf, extractJsonSpan, numberInRange, oneOf, parseAgentJson, str } from './json';

test('parses a clean object', () => {
  const parsed = parseAgentJson<{ verdict: string }>('{"verdict": "fine"}');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data?.verdict, 'fine');
});

test('tolerates a fenced block', () => {
  const parsed = parseAgentJson<{ a: number }>('```json\n{"a": 1}\n```');
  assert.equal(parsed.data?.a, 1);
});

test('tolerates lead-in prose', () => {
  const parsed = parseAgentJson<{ a: number }>('Here is the analysis:\n{"a": 1}');
  assert.equal(parsed.data?.a, 1);
});

test('tolerates a trailing sentence after the object', () => {
  const parsed = parseAgentJson<{ a: number }>('{"a": 1}\n\nLet me know if you want more detail.');
  assert.equal(parsed.data?.a, 1);
});

test('a brace inside a string does not end the span', () => {
  const span = extractJsonSpan('{"verdict": "they wrote {this} in the caption", "n": 2}');
  assert.equal(span, '{"verdict": "they wrote {this} in the caption", "n": 2}');
});

test('an escaped quote does not end the string', () => {
  const parsed = parseAgentJson<{ q: string }>('{"q": "she said \\"no\\" twice"}');
  assert.equal(parsed.data?.q, 'she said "no" twice');
});

test('a failed parse keeps the prose and reports the failure', () => {
  const parsed = parseAgentJson('The sentiment was broadly positive, though I could not format it.');
  assert.equal(parsed.ok, false);
  assert.equal(parsed.data, null);
  assert.match(parsed.raw, /broadly positive/);
  assert.ok(parsed.error);
});

test('an empty reply is a failure, not an empty report', () => {
  const parsed = parseAgentJson('   ');
  assert.equal(parsed.ok, false);
  assert.ok(parsed.error);
});

test('numberInRange returns null for a missing value rather than a neutral default', () => {
  assert.equal(numberInRange(undefined, 0, 100), null);
  assert.equal(numberInRange('not a number', 0, 100), null);
  assert.equal(numberInRange(140, 0, 100), 100);
  assert.equal(numberInRange(42, 0, 100), 42);
});

test('oneOf falls back rather than passing an unknown value through', () => {
  assert.equal(oneOf('high', ['high', 'low'] as const, 'low'), 'high');
  assert.equal(oneOf('URGENT', ['high', 'low'] as const, 'low'), 'low');
});

test('arrayOf drops entries that map to null and ignores non-arrays', () => {
  assert.deepEqual(arrayOf<string>(['a', '', 'b'], (v) => str(v) || null), ['a', 'b']);
  assert.deepEqual(arrayOf<string>('not an array', (v) => str(v) || null), []);
});

test('str caps runaway fields', () => {
  assert.equal(str('x'.repeat(50), 10).length, 10);
});
