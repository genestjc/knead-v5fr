'use client';

/**
 * Client calls for the Probatio Parsley console.
 *
 * Normally every call goes through adminFetch, which signs the request with
 * the connected wallet (one prompt covers a burst of calls). In demo mode
 * there is no wallet, so `account` is null and the calls go out unsigned —
 * the server side of the bypass lives in lib/eval/require-admin.ts. Either
 * way the server is the authority; this module just keeps the fetch
 * boilerplate out of the components.
 */
import type { Account } from 'thirdweb/wallets';
import { adminFetch } from '@/lib/admin/admin-fetch';
import type {
  EvalCriterion,
  EvalProvider,
  EvalResult,
  EvalRun,
  EvalTurn,
  SocialPlatform,
  Verdict,
} from '@/lib/eval/types';
import type { SocialJudgement } from '@/lib/eval/social-judge';
import type { SocialMedia } from '@/lib/eval/social-media';
import type { ComposerResult, StoryBrief } from '@/lib/eval/social-composer';
import type { AeoSignals } from '@/lib/eval/aeo-signals';
import type { StorySignals } from '@/lib/eval/aeo-story';
import type { StoryAnalysis } from '@/lib/eval/aeo-analyst';
import type { DraftReport as FullDraftReport } from '@/lib/eval/draft-check';
import type { DraftAdvice } from '@/lib/eval/draft-advisor';

/** The route strips bodyText before responding — it is large and server-only. */
export type DraftReport = Omit<FullDraftReport, 'bodyText'>;

/** The route strips extractedText before responding — it is large and server-only. */
export type StorySignalsLite = Omit<StorySignals, 'extractedText'>;

/** Signed when there's a wallet, plain fetch when there isn't (demo mode). */
function call(
  input: string,
  account: Account | null,
  init: RequestInit = {},
): Promise<Response> {
  return account ? adminFetch(input, account, init) : fetch(input, init);
}

async function unwrap<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body as T;
}

export async function fetchCriteria(
  account: Account | null,
): Promise<{ criteria: EvalCriterion[]; seedError: string | null }> {
  const res = await call('/api/probatio/criteria', account);
  const body = await unwrap<{ criteria: EvalCriterion[]; seedError?: string | null }>(res);
  return { criteria: body.criteria, seedError: body.seedError ?? null };
}

export async function createCriterion(
  account: Account | null,
  input: {
    surface: string;
    prompt: string;
    guidance?: string;
    expectedVerdict?: 'pass' | 'fail';
    /** 1-3. Only the social audit uses the range; everything else is 1. */
    weight?: number;
    /** Scopes a social-audit row to one platform. Null applies everywhere. */
    platform?: SocialPlatform | null;
  },
): Promise<EvalCriterion> {
  const res = await call('/api/probatio/criteria', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await unwrap<{ criterion: EvalCriterion }>(res)).criterion;
}

export async function updateCriterion(
  account: Account | null,
  id: string,
  patch: Partial<{
    prompt: string;
    guidance: string | null;
    expectedVerdict: 'pass' | 'fail';
    weight: number;
    platform: SocialPlatform | null;
    isActive: boolean;
  }>,
): Promise<EvalCriterion> {
  const res = await call(`/api/probatio/criteria/${id}`, account, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return (await unwrap<{ criterion: EvalCriterion }>(res)).criterion;
}

export async function deleteCriterion(account: Account | null, id: string, hard = false): Promise<void> {
  const res = await call(`/api/probatio/criteria/${id}${hard ? '?hard=true' : ''}`, account, {
    method: 'DELETE',
  });
  await unwrap(res);
}

export async function fetchRuns(account: Account | null, surface?: string): Promise<EvalRun[]> {
  const qs = surface ? `?surface=${encodeURIComponent(surface)}` : '';
  const res = await call(`/api/probatio/runs${qs}`, account);
  return (await unwrap<{ runs: EvalRun[] }>(res)).runs;
}

export async function fetchRun(account: Account | null, id: string): Promise<EvalRun> {
  const res = await call(`/api/probatio/runs/${id}`, account);
  return (await unwrap<{ run: EvalRun }>(res)).run;
}

export async function createHumanRun(
  account: Account | null,
  input: { surface: string; title: string; persona?: string | null; notes?: string; transcript?: string },
): Promise<{ run: EvalRun; turnsSaved: number }> {
  const res = await call('/api/probatio/runs', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<{ run: EvalRun; turnsSaved: number }>(res);
}

export async function updateRun(
  account: Account | null,
  id: string,
  patch: Partial<{ title: string; notes: string; summary: string }>,
): Promise<EvalRun> {
  const res = await call(`/api/probatio/runs/${id}`, account, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return (await unwrap<{ run: EvalRun }>(res)).run;
}

export async function deleteRun(account: Account | null, id: string): Promise<void> {
  const res = await call(`/api/probatio/runs/${id}`, account, { method: 'DELETE' });
  await unwrap(res);
}

export async function saveHumanVerdicts(
  account: Account | null,
  runId: string,
  verdicts: { criterionId: string; verdict: Verdict; rationale?: string | null }[],
): Promise<EvalResult[]> {
  const res = await call(`/api/probatio/runs/${runId}/results`, account, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verdicts }),
  });
  return (await unwrap<{ results: EvalResult[] }>(res)).results;
}

export async function startAgentRun(
  account: Account | null,
  input: {
    surface: string;
    persona: string;
    /** Optional errand the persona pursues, in character, for this run. */
    personaGoal?: string;
    provider: EvalProvider;
    slug?: string;
    recipeIds?: string[];
    surfaceModel?: 'sonnet-5' | 'gpt-5';
    maxTurns?: number;
    title?: string;
  },
): Promise<{ run: EvalRun; turns: EvalTurn[]; done: boolean }> {
  const res = await call('/api/probatio/agent-run', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<{ run: EvalRun; turns: EvalTurn[]; done: boolean }>(res);
}

export async function stepAgentRun(
  account: Account | null,
  runId: string,
): Promise<{ done: boolean; turns: EvalTurn[]; exchangeCount: number; maxTurns?: number; surfaceError?: string }> {
  const res = await call('/api/probatio/agent-run/step', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId }),
  });
  return unwrap(res);
}

export async function startAeoAudit(
  account: Account | null,
  input: { subjectUrl: string; competitorUrls: string[]; title?: string },
): Promise<{
  run: EvalRun;
  turns: EvalTurn[];
  signals: AeoSignals[];
  subjectScore: number | null;
  fieldMedian: number | null;
  done: boolean;
}> {
  const res = await call('/api/probatio/aeo-audit', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap(res);
}

export async function startStoryAudit(
  account: Account | null,
  input: {
    subject: string;
    ourUrl: string;
    competitorUrls: string[];
    provider?: EvalProvider;
    analyze?: boolean;
    title?: string;
  },
): Promise<{
  run: EvalRun;
  turns: EvalTurn[];
  signals: StorySignalsLite[];
  subject: string;
  subjectScore: number | null;
  fieldMedian: number | null;
  analysis: StoryAnalysis | null;
  done: boolean;
}> {
  const res = await call('/api/probatio/aeo-story', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap(res);
}

export async function checkDraft(
  account: Account | null,
  input: { id: string; provider?: EvalProvider; advise?: boolean },
): Promise<{
  documentId: string;
  isDraft: boolean;
  report: DraftReport;
  reportText: string;
  advice: DraftAdvice | null;
}> {
  const res = await call('/api/probatio/draft-check', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap(res);
}

// ─── social audit ───────────────────────────────────────────────────────────

/** One post as the console holds it, before it is turned into a request. */
export interface SocialPostDraft {
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

export function postDraftIsEmpty(draft: SocialPostDraft): boolean {
  return !draft.text.trim() && draft.images.length === 0 && !draft.uploadId;
}

/**
 * Upload a screen recording.
 *
 * Three steps, all here so a component never has to know the shape: ask our
 * server for a Mux upload URL, PUT the file straight to Mux, then poll until
 * the asset is transcoded. The file never passes through our server, which is
 * the only reason a sixty-second recording works at all.
 */
export async function uploadRecording(
  account: Account | null,
  file: File,
  meta: { label?: string; platform?: SocialPlatform | null; isOurs?: boolean },
  onStatus?: (status: 'uploading' | 'waiting') => void,
): Promise<SocialMedia> {
  const res = await call('/api/probatio/social-media', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
  const { media, uploadUrl } = await unwrap<{ media: SocialMedia; uploadUrl: string }>(res);

  onStatus?.('uploading');
  const put = await fetch(uploadUrl, { method: 'PUT', body: file });
  if (!put.ok) throw new Error(`The recording could not be uploaded to Mux (${put.status}).`);

  onStatus?.('waiting');
  return pollRecording(account, media.muxUploadId!);
}

/**
 * Wait for Mux to finish transcoding.
 *
 * Polled on a fixed two-second interval with a hard ceiling. Transcoding a
 * short screen recording takes seconds; anything past the ceiling is a problem
 * the person should be told about rather than a spinner that runs forever.
 */
async function pollRecording(
  account: Account | null,
  uploadId: string,
  { intervalMs = 2_000, timeoutMs = 180_000 } = {},
): Promise<SocialMedia> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await call(
      `/api/probatio/social-media?uploadId=${encodeURIComponent(uploadId)}`,
      account,
    );
    const body = await unwrap<{ status: string; media: SocialMedia | null; error?: string }>(res);

    if (body.status === 'errored') {
      throw new Error(body.media?.error || body.error || 'Mux could not process the recording.');
    }
    if (body.status === 'ready' && body.media) return body.media;

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    'The recording is still processing after three minutes. It may still finish — reload and check before re-uploading.',
  );
}

export interface SocialAuditResult {
  run: EvalRun;
  turns: EvalTurn[];
  judgement: SocialJudgement & { model: string };
  criteria: EvalCriterion[];
  summary: string;
}

export async function runSocialAudit(
  account: Account | null,
  input: {
    platform: SocialPlatform;
    provider: EvalProvider;
    subject?: string;
    title?: string;
    ours: unknown;
    theirs: unknown[];
  },
): Promise<SocialAuditResult> {
  const res = await call('/api/probatio/social-audit', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<SocialAuditResult>(res);
}

export async function fetchComposerStories(account: Account | null): Promise<StoryBrief[]> {
  const res = await call('/api/probatio/social-compose', account);
  return (await unwrap<{ stories: StoryBrief[] }>(res)).stories;
}

export async function composeSocialDrafts(
  account: Account | null,
  input: {
    slug: string;
    provider: EvalProvider;
    platforms?: SocialPlatform[];
    /** The audit these drafts should answer. */
    auditRunId?: string | null;
  },
): Promise<{ result: ComposerResult; story: StoryBrief; summary: string; auditNote: string | null }> {
  const res = await call('/api/probatio/social-compose', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap(res);
}

export async function judge(
  account: Account | null,
  runId: string,
  provider: EvalProvider,
): Promise<{ results: EvalResult[]; summary: string; judgeModel: string; judgedBy: EvalProvider; unscored: number }> {
  const res = await call('/api/probatio/judge', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId, provider }),
  });
  return unwrap(res);
}
