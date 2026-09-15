'use client';

/**
 * Client calls for the Social 54 console.
 *
 * Same arrangement as components/probatio/api.ts: every call is signed with
 * the connected wallet through adminFetch (one prompt covers a burst), and
 * goes out unsigned only when there is no wallet — which here only happens
 * under SOCIAL54_DEMO_MODE, off by default. The server is the authority
 * either way; this module keeps fetch boilerplate out of the tabs.
 */
import type { Account } from 'thirdweb/wallets';
import { adminFetch } from '@/lib/admin/admin-fetch';
import type { PlatformStatus } from '@/lib/social/config';
import type { FieldStats } from '@/lib/social/field';
import type { StoryBrief, ComposerResult } from '@/lib/social/agents/composer';
import type { SentimentReport } from '@/lib/social/agents/sentiment';
import type { TrendReport } from '@/lib/social/agents/trends';
import type { EditorialSweep } from '@/lib/social/editorial';
import type { HeadToHeadOutcome, HeadToHeadReport } from '@/lib/social/agents/head-to-head';
import type {
  AgentProvider,
  Competitor,
  CompetitorHandle,
  SocialPlatform,
  SocialRun,
  SocialRunKind,
  SocialSnapshot,
} from '@/lib/social/types';

function call(input: string, account: Account | null, init: RequestInit = {}): Promise<Response> {
  return account ? adminFetch(input, account, init) : fetch(input, init);
}

async function unwrap<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Request failed (${res.status})`);
  return body as T;
}

function post(input: string, account: Account | null, payload: unknown): Promise<Response> {
  return call(input, account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ─── console state ────────────────────────────────────────────────────────

export interface ConsoleState {
  platforms: PlatformStatus[];
  competitors: Competitor[];
  seedError: string | null;
  archive: { earliest: string | null; posts: number };
}

export async function fetchConsoleState(account: Account | null): Promise<ConsoleState> {
  return unwrap<ConsoleState>(await call('/api/social/snapshot', account));
}

// ─── pulse ────────────────────────────────────────────────────────────────

export interface PulseResult {
  snapshot: SocialSnapshot;
  stats: FieldStats;
  headline: string;
  caveats: string[];
  archived: number;
  archiveError: string | null;
}

export async function runPulse(
  account: Account | null,
  input: { windowDays: number; platforms?: SocialPlatform[]; includeComments?: boolean },
): Promise<PulseResult> {
  return unwrap<PulseResult>(await post('/api/social/snapshot', account, input));
}

// ─── sentiment ────────────────────────────────────────────────────────────

export interface SentimentResult {
  run: SocialRun;
  report: SentimentReport | null;
  caveats: string[];
  sampleSize: number;
}

export async function runSentiment(
  account: Account | null,
  input: { windowDays: number; provider: AgentProvider; subject?: string },
): Promise<SentimentResult> {
  return unwrap<SentimentResult>(await post('/api/social/sentiment', account, input));
}

// ─── trends ───────────────────────────────────────────────────────────────

export interface TrendsResult {
  run: SocialRun;
  report: TrendReport;
  stats: FieldStats;
  caveats: string[];
  archiveDays: number | null;
  /** What the field published, from their own feeds. Null if the sweep failed. */
  editorial: EditorialSweep | null;
  headline: string;
}

export async function runTrends(
  account: Account | null,
  input: { windowDays: number; lookbackDays: number; provider: AgentProvider },
): Promise<TrendsResult> {
  return unwrap<TrendsResult>(await post('/api/social/trends', account, input));
}

// ─── head to head ─────────────────────────────────────────────────────────

export interface HeadToHeadResult {
  run: SocialRun;
  outcome: HeadToHeadOutcome;
  scoreboardText: string;
  report: HeadToHeadReport | null;
  analystError?: string | null;
  caveats: string[];
}

export async function runHeadToHead(
  account: Account | null,
  input: {
    subject: string;
    windowDays: number;
    lookbackDays: number;
    provider: AgentProvider;
    analyze: boolean;
  },
): Promise<HeadToHeadResult> {
  return unwrap<HeadToHeadResult>(await post('/api/social/head-to-head', account, input));
}

// ─── composer ─────────────────────────────────────────────────────────────

export async function fetchStories(account: Account | null): Promise<StoryBrief[]> {
  return (await unwrap<{ stories: StoryBrief[] }>(await call('/api/social/compose', account))).stories;
}

export interface ComposeResult {
  run: SocialRun;
  result: ComposerResult;
  story: StoryBrief;
  evidencePosts: number;
}

export async function runCompose(
  account: Account | null,
  input: { slug: string; provider: AgentProvider; platforms?: SocialPlatform[] },
): Promise<ComposeResult> {
  return unwrap<ComposeResult>(await post('/api/social/compose', account, input));
}

// ─── competitors ──────────────────────────────────────────────────────────

export async function fetchCompetitors(
  account: Account | null,
): Promise<{ competitors: Competitor[]; seedError: string | null }> {
  return unwrap(await call('/api/social/competitors', account));
}

export async function addCompetitor(
  account: Account | null,
  input: { name: string; note?: string; handles: CompetitorHandle[]; feedUrl?: string },
): Promise<{ competitor: Competitor; feedNote: string }> {
  return unwrap<{ competitor: Competitor; feedNote: string }>(
    await post('/api/social/competitors', account, input),
  );
}

export async function patchCompetitor(
  account: Account | null,
  id: string,
  patch: Partial<{
    name: string;
    note: string | null;
    handles: CompetitorHandle[];
    feedUrl: string | null;
    isActive: boolean;
  }>,
): Promise<Competitor> {
  const res = await call(`/api/social/competitors/${id}`, account, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return (await unwrap<{ competitor: Competitor }>(res)).competitor;
}

export async function removeCompetitor(account: Account | null, id: string): Promise<void> {
  await unwrap(await call(`/api/social/competitors/${id}`, account, { method: 'DELETE' }));
}

// ─── runs ─────────────────────────────────────────────────────────────────

export async function fetchRuns(account: Account | null, kind?: SocialRunKind): Promise<SocialRun[]> {
  const qs = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return (await unwrap<{ runs: SocialRun[] }>(await call(`/api/social/runs${qs}`, account))).runs;
}

export async function fetchRun(account: Account | null, id: string): Promise<SocialRun> {
  return (await unwrap<{ run: SocialRun }>(await call(`/api/social/runs/${id}`, account))).run;
}

export async function deleteRun(account: Account | null, id: string): Promise<void> {
  await unwrap(await call(`/api/social/runs/${id}`, account, { method: 'DELETE' }));
}
