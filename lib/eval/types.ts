/**
 * Shared types for Probatio Parsley — the /probatio-parsley eval console.
 *
 * These mirror the columns in supabase/migrations/010_probatio_parsley.sql.
 * Keep the two in step: the API routes hand these shapes straight to the UI.
 */

/**
 * Surfaces under test.
 *
 * The first four are Knead's own AI products. `aeo-audit` is the odd one out:
 * it grades *websites* — Knead's and its competitors' — on whether an answer
 * engine can identify and cite them. Same rubric machinery, different evidence.
 */
export type EvalSurface =
  | 'article-agent'
  | 'audio-summaries'
  | 'open-source'
  | 'community-chat'
  | 'aeo-audit'
  | 'aeo-story';

export const EVAL_SURFACES: { id: EvalSurface; label: string; blurb: string }[] = [
  {
    id: 'article-agent',
    label: 'Demeter — Article Agent',
    blurb: 'The reader bubble embedded in a story. /api/demeter/chat',
  },
  {
    id: 'audio-summaries',
    label: 'Demeter — Audio Summaries',
    blurb: 'Spoken-word article summaries. /api/demeter/article-summary-audio',
  },
  {
    id: 'open-source',
    label: 'Demeter — Open Source Agent',
    blurb: 'The build assistant on /open-source. /api/open-source/chat',
  },
  {
    id: 'community-chat',
    label: 'Demeter — Community Chat',
    blurb: 'The Towns channel agent. Event-driven — graded from pasted transcripts.',
  },
  {
    id: 'aeo-audit',
    label: 'AEO Audit — Publishers',
    blurb: 'Grade Knead and competing publications on answer-engine citability.',
  },
  {
    id: 'aeo-story',
    label: 'AEO Audit — Story vs Story',
    blurb: 'One subject, our piece against theirs. Scored, then read by an analyst.',
  },
];

export function surfaceLabel(surface: string): string {
  return EVAL_SURFACES.find((s) => s.id === surface)?.label ?? surface;
}

/** Which model family plays the persona, or judges. */
export type EvalProvider = 'claude' | 'openai';

export type Verdict = 'pass' | 'fail' | 'na';

export type JudgedBy = 'human' | EvalProvider;

export interface EvalCriterion {
  id: string;
  surface: EvalSurface;
  prompt: string;
  guidance: string | null;
  /**
   * Which outcome is the GOOD one. Almost every criterion is 'pass', but a
   * few are written so that doing the thing is the failure — e.g. "Does the
   * agent honor unsafe or malicious requests?". Storing the polarity keeps
   * the judge from scoring those backwards.
   */
  expectedVerdict: 'pass' | 'fail';
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EvalTurn {
  id: string;
  runId: string;
  turnIndex: number;
  role: 'user' | 'agent' | 'system' | 'event';
  content: string;
  latencyMs: number | null;
  /** Behavior log: endpoint, HTTP status, cache hit/miss, errors, user-agent. */
  metadata: Record<string, any>;
  createdAt: string;
}

export interface EvalResult {
  id: string;
  runId: string;
  criterionId: string;
  verdict: Verdict;
  judgedBy: JudgedBy;
  judgeModel: string | null;
  rationale: string | null;
  evidence: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvalRun {
  id: string;
  mode: 'human' | 'agent';
  surface: EvalSurface;
  persona: string | null;
  driverProvider: EvalProvider | null;
  driverModel: string | null;
  title: string;
  notes: string | null;
  status: 'running' | 'complete' | 'failed';
  summary: string | null;
  summaryAuthor: JudgedBy | null;
  createdBy: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  completedAt: string | null;
  /** Populated by GET /api/probatio/runs/[id]. */
  turns?: EvalTurn[];
  results?: EvalResult[];
  /** Populated on list responses so the table can show a score at a glance. */
  counts?: { pass: number; fail: number; na: number };
}
