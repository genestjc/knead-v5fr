'use client';

/**
 * Client calls for the Probatio Parsley console.
 *
 * Everything goes through adminFetch, which signs the request with the
 * connected wallet (one prompt covers a burst of calls). The server is the
 * authority on who may read or write — this module just keeps the fetch
 * boilerplate out of the components.
 */
import type { Account } from 'thirdweb/wallets';
import { adminFetch } from '@/lib/admin/admin-fetch';
import type { EvalCriterion, EvalProvider, EvalResult, EvalRun, EvalTurn, Verdict } from '@/lib/eval/types';

async function unwrap<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body as T;
}

export async function fetchCriteria(account: Account): Promise<EvalCriterion[]> {
  const res = await adminFetch('/api/probatio/criteria', account);
  return (await unwrap<{ criteria: EvalCriterion[] }>(res)).criteria;
}

export async function createCriterion(
  account: Account,
  input: { surface: string; prompt: string; guidance?: string; expectedVerdict?: 'pass' | 'fail' },
): Promise<EvalCriterion> {
  const res = await adminFetch('/api/probatio/criteria', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await unwrap<{ criterion: EvalCriterion }>(res)).criterion;
}

export async function updateCriterion(
  account: Account,
  id: string,
  patch: Partial<{ prompt: string; guidance: string | null; expectedVerdict: 'pass' | 'fail'; isActive: boolean }>,
): Promise<EvalCriterion> {
  const res = await adminFetch(`/api/probatio/criteria/${id}`, account, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return (await unwrap<{ criterion: EvalCriterion }>(res)).criterion;
}

export async function deleteCriterion(account: Account, id: string, hard = false): Promise<void> {
  const res = await adminFetch(`/api/probatio/criteria/${id}${hard ? '?hard=true' : ''}`, account, {
    method: 'DELETE',
  });
  await unwrap(res);
}

export async function fetchRuns(account: Account, surface?: string): Promise<EvalRun[]> {
  const qs = surface ? `?surface=${encodeURIComponent(surface)}` : '';
  const res = await adminFetch(`/api/probatio/runs${qs}`, account);
  return (await unwrap<{ runs: EvalRun[] }>(res)).runs;
}

export async function fetchRun(account: Account, id: string): Promise<EvalRun> {
  const res = await adminFetch(`/api/probatio/runs/${id}`, account);
  return (await unwrap<{ run: EvalRun }>(res)).run;
}

export async function createHumanRun(
  account: Account,
  input: { surface: string; title: string; persona?: string | null; notes?: string; transcript?: string },
): Promise<{ run: EvalRun; turnsSaved: number }> {
  const res = await adminFetch('/api/probatio/runs', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<{ run: EvalRun; turnsSaved: number }>(res);
}

export async function updateRun(
  account: Account,
  id: string,
  patch: Partial<{ title: string; notes: string; summary: string }>,
): Promise<EvalRun> {
  const res = await adminFetch(`/api/probatio/runs/${id}`, account, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return (await unwrap<{ run: EvalRun }>(res)).run;
}

export async function deleteRun(account: Account, id: string): Promise<void> {
  const res = await adminFetch(`/api/probatio/runs/${id}`, account, { method: 'DELETE' });
  await unwrap(res);
}

export async function saveHumanVerdicts(
  account: Account,
  runId: string,
  verdicts: { criterionId: string; verdict: Verdict; rationale?: string | null }[],
): Promise<EvalResult[]> {
  const res = await adminFetch(`/api/probatio/runs/${runId}/results`, account, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verdicts }),
  });
  return (await unwrap<{ results: EvalResult[] }>(res)).results;
}

export async function startAgentRun(
  account: Account,
  input: {
    surface: string;
    persona: string;
    provider: EvalProvider;
    slug?: string;
    recipeIds?: string[];
    surfaceModel?: 'sonnet-5' | 'gpt-5';
    maxTurns?: number;
    title?: string;
  },
): Promise<{ run: EvalRun; turns: EvalTurn[]; done: boolean }> {
  const res = await adminFetch('/api/probatio/agent-run', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<{ run: EvalRun; turns: EvalTurn[]; done: boolean }>(res);
}

export async function stepAgentRun(
  account: Account,
  runId: string,
): Promise<{ done: boolean; turns: EvalTurn[]; exchangeCount: number; maxTurns?: number; surfaceError?: string }> {
  const res = await adminFetch('/api/probatio/agent-run/step', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId }),
  });
  return unwrap(res);
}

export async function judge(
  account: Account,
  runId: string,
  provider: EvalProvider,
): Promise<{ results: EvalResult[]; summary: string; judgeModel: string; judgedBy: EvalProvider; unscored: number }> {
  const res = await adminFetch('/api/probatio/judge', account, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId, provider }),
  });
  return unwrap(res);
}
