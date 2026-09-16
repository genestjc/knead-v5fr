/**
 * A post as the Social Audit console holds it, and the rules for whether it can
 * be sent.
 *
 * Split out of components/probatio/api.ts so it can be tested without pulling
 * in a wallet SDK. That matters here more than it usually would: these three
 * predicates are what decided, silently and wrongly, that a competitor post
 * with a failed upload did not exist.
 */

/** One post as the console holds it, before it is turned into a request. */
export interface SocialPostDraft {
  /**
   * Stable across edits and reorders.
   *
   * The list used to be keyed and updated by array index, which meant removing
   * a competitor shifted every row below it onto a different draft, and two
   * uploads finishing out of order wrote to the wrong one.
   */
  id: string;
  label: string;
  handle: string;
  /** Link to the post itself. */
  url: string;
  /**
   * Link to the article the post points at.
   *
   * Fetched server-side and read alongside the post. Several rubric rows — "do
   * the claims hold up against the story it points at" chief among them —
   * cannot be answered from a caption alone and come back N/A without it.
   */
  storyUrl: string;
  /** Anything else worth telling the judge, in the person's own words. */
  notes: string;
  text: string;
  comments: string;
  /** data: URLs, read in the browser. Sent inline. */
  images: string[];
  /** A Mux upload, once one has been filmed and accepted. */
  uploadId: string | null;
  uploadStatus: 'idle' | 'uploading' | 'waiting' | 'ready' | 'errored';
  uploadError: string | null;
  playbackId: string | null;
  durationSeconds: number | null;
}

export function emptyPostDraft(label: string): SocialPostDraft {
  return {
    id: newDraftId(),
    label,
    handle: '',
    url: '',
    storyUrl: '',
    notes: '',
    text: '',
    comments: '',
    images: [],
    uploadId: null,
    uploadStatus: 'idle',
    uploadError: null,
    playbackId: null,
    durationSeconds: null,
  };
}

/** crypto.randomUUID is unavailable on http origins in some browsers. */
function newDraftId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Nothing has been put in this row at all — not even a name. */
export function postDraftIsUntouched(draft: SocialPostDraft): boolean {
  return (
    !draft.text.trim() &&
    !draft.comments.trim() &&
    !draft.notes.trim() &&
    !draft.handle.trim() &&
    !draft.url.trim() &&
    !draft.storyUrl.trim() &&
    draft.images.length === 0 &&
    draft.uploadStatus === 'idle' &&
    !draft.uploadId
  );
}

/** Whether this row carries something the judge can actually look at. */
export function postDraftHasEvidence(draft: SocialPostDraft): boolean {
  return (
    draft.text.trim().length > 0 ||
    draft.images.length > 0 ||
    (draft.uploadStatus === 'ready' && Boolean(draft.uploadId))
  );
}

/**
 * Why this post cannot be sent — or null when it can.
 *
 * This exists because a post with a failed or unfinished upload used to be
 * dropped silently, on BOTH sides: the browser filtered it out of the request
 * and the route skipped past it. You uploaded a competitor's video, the upload
 * errored, and what came back was a solo audit with no competitor and no
 * explanation for where it went. Whatever the reason, it has to be said.
 */
export function postDraftBlocker(draft: SocialPostDraft): string | null {
  if (postDraftHasEvidence(draft)) return null;

  switch (draft.uploadStatus) {
    case 'uploading':
      return 'its recording is still uploading';
    case 'waiting':
      return 'Mux is still processing its recording';
    case 'errored':
      return `its recording failed to upload${draft.uploadError ? ` — ${draft.uploadError}` : ''}`;
    default:
      return 'it has no screenshot, recording or caption';
  }
}
