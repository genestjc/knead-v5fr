/**
 * These three predicates decided that a competitor post did not exist.
 *
 * The bug: a competitor's recording failed to upload, so `uploadId` stayed
 * null. The browser filtered the row out of the request as "empty" and the
 * route skipped past it for the same reason. What came back was a solo audit —
 * no competitor, no comparison, and nothing said about where it had gone. Both
 * sides were individually defensible and together they lost data in silence.
 *
 * So the cases below are all about the difference between "there is nothing
 * here" and "there is something here that is not ready", which is the
 * distinction the original code did not make.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  emptyPostDraft,
  postDraftBlocker,
  postDraftHasEvidence,
  postDraftIsUntouched,
  type SocialPostDraft,
} from './social-draft';

function draft(over: Partial<SocialPostDraft> = {}): SocialPostDraft {
  return { ...emptyPostDraft('Hyperallergic'), ...over };
}

// ─── the row nobody filled in ───────────────────────────────────────────────

test('a fresh row is untouched, and is not a blocker', () => {
  const d = draft();
  assert.equal(postDraftIsUntouched(d), true);
  assert.equal(postDraftHasEvidence(d), false);
  // Untouched rows are skipped without complaint — clicking "add a competitor"
  // and changing your mind should not hold the audit.
});

test('a row with only a name typed into it is no longer untouched', () => {
  // This is the row that must block: someone started filling it in, so
  // dropping it silently loses work they can see on screen.
  const d = draft({ handle: 'hyperallergic' });
  assert.equal(postDraftIsUntouched(d), false);
  assert.equal(postDraftHasEvidence(d), false);
  assert.match(postDraftBlocker(d) ?? '', /no screenshot, recording or caption/);
});

test('a story link alone counts as touched', () => {
  const d = draft({ storyUrl: 'https://hyperallergic.com/nadler' });
  assert.equal(postDraftIsUntouched(d), false);
});

// ─── evidence ───────────────────────────────────────────────────────────────

test('a pasted caption is evidence', () => {
  const d = draft({ text: 'The gallery closed in 1998.' });
  assert.equal(postDraftHasEvidence(d), true);
  assert.equal(postDraftBlocker(d), null);
});

test('a screenshot is evidence', () => {
  const d = draft({ images: ['data:image/jpeg;base64,abcd'] });
  assert.equal(postDraftHasEvidence(d), true);
  assert.equal(postDraftBlocker(d), null);
});

test('a finished recording is evidence', () => {
  const d = draft({ uploadId: 'up_123', uploadStatus: 'ready' });
  assert.equal(postDraftHasEvidence(d), true);
  assert.equal(postDraftBlocker(d), null);
});

// ─── the bug: uploads that did not finish ───────────────────────────────────

test('a failed upload blocks the run and says what failed', () => {
  // THE ORIGINAL BUG. uploadId is null because it is only set on success, so
  // this row read as empty and was dropped on both sides without a word.
  const d = draft({ uploadStatus: 'errored', uploadError: 'Mux rejected the upload.' });
  assert.equal(postDraftHasEvidence(d), false, 'nothing to judge, correctly');
  const blocker = postDraftBlocker(d);
  assert.match(blocker ?? '', /failed to upload/);
  assert.match(blocker ?? '', /Mux rejected the upload/, 'the reason travels with the blocker');
});

test('an upload still in flight blocks rather than being dropped', () => {
  assert.match(postDraftBlocker(draft({ uploadStatus: 'uploading' })) ?? '', /still uploading/);
  assert.match(postDraftBlocker(draft({ uploadStatus: 'waiting' })) ?? '', /still processing/);
});

test('an uploadId without a ready status is not yet evidence', () => {
  // The row has an id but Mux has not finished, so the route would find no
  // frames. Treating it as sendable is how you get an audit with an empty post.
  const d = draft({ uploadId: 'up_123', uploadStatus: 'waiting' });
  assert.equal(postDraftHasEvidence(d), false);
  assert.match(postDraftBlocker(d) ?? '', /still processing/);
});

test('a failed recording alongside a pasted caption is still sendable', () => {
  // The upload broke but there is a caption, so there is something to judge.
  // Holding the whole audit over a recording you no longer need would be the
  // opposite mistake.
  const d = draft({
    text: 'The gallery closed in 1998.',
    uploadStatus: 'errored',
    uploadError: 'Mux rejected the upload.',
  });
  assert.equal(postDraftHasEvidence(d), true);
  assert.equal(postDraftBlocker(d), null);
});

// ─── identity ───────────────────────────────────────────────────────────────

test('every draft gets its own id', () => {
  // Rows used to be keyed and patched by array index, so removing one shifted
  // every row below it onto a different draft, and two uploads finishing out of
  // order wrote to the wrong one.
  const ids = new Set([0, 1, 2, 3, 4].map(() => emptyPostDraft('x').id));
  assert.equal(ids.size, 5);
  assert.ok([...ids].every((id) => typeof id === 'string' && id.length > 0));
});
