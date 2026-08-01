/**
 * Surface drivers — how Probatio Parsley actually talks to each Knead AI
 * product.
 *
 * These call the REAL endpoints over HTTP, on the same origin, exactly the way
 * a browser would: same request bodies, same headers, same rate limits. An
 * eval that mocked the agent would only ever test the mock, so nothing here is
 * simulated except the user-agent (which is the point — see personas.ts).
 *
 * Every call returns a behavior log alongside the text: endpoint, HTTP status,
 * latency, cache hit/miss, error body. That log is what makes a failed rubric
 * row traceable back to an input instead of a vibe.
 */
import type { EvalSurface } from './types';
import { DEFAULT_USER_AGENT, INSTAGRAM_USER_AGENT, type Persona } from './personas';

export interface DriverContext {
  /** Origin of the running app, e.g. https://kneadmag.com — taken from the request. */
  origin: string;
  userAgent: string;
  /** Article slug for the article agent and audio summaries. */
  slug?: string;
  /** Build recipes to load for the open-source agent. */
  recipeIds?: string[];
  /** Which model the open-source surface's own picker should run. */
  surfaceModel?: 'sonnet-5' | 'gpt-5';
}

export interface SurfaceReply {
  ok: boolean;
  /** The agent's visible reply. Empty when the call failed. */
  text: string;
  latencyMs: number;
  /** Behavior log for this exchange — saved on the turn row. */
  log: Record<string, any>;
}

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function userAgentFor(persona: Persona | undefined): string {
  return persona?.inAppBrowser === 'instagram' ? INSTAGRAM_USER_AGENT : DEFAULT_USER_AGENT;
}

/** Surfaces a persona can hold a live conversation with. */
export const CONVERSATIONAL_SURFACES: EvalSurface[] = ['article-agent', 'open-source'];

/**
 * Why a surface can't be driven automatically, when it can't. The console
 * shows this instead of pretending the run happened.
 */
export const SURFACE_BLOCKERS: Partial<Record<EvalSurface, string>> = {
  'community-chat':
    "The community agent is event-driven — it listens on a Towns channel and its tools move real money (virtual cards, USDC). Driving it from here would post live messages into the member channel, so runs for this surface are recorded by pasting a real transcript in the Human Evaluation tab, where a human or an LLM judge can still grade it against the same rubric.",
};

async function postJSON(
  url: string,
  body: unknown,
  userAgent: string,
): Promise<{ status: number; json: any; text: string; ms: number }> {
  const started = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const ms = Date.now() - started;
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body — keep the raw text for the log */
  }
  return { status: res.status, json, text, ms };
}

/** Demeter's article reader bubble. */
async function sendArticleTurn(
  ctx: DriverContext,
  message: string,
  history: ChatHistoryTurn[],
): Promise<SurfaceReply> {
  const endpoint = `${ctx.origin}/api/demeter/chat`;
  try {
    const { status, json, text, ms } = await postJSON(
      endpoint,
      { message, slug: ctx.slug, history },
      ctx.userAgent,
    );
    const reply = json?.reply ?? '';
    return {
      ok: status === 200 && Boolean(reply),
      text: reply,
      latencyMs: ms,
      log: {
        endpoint,
        status,
        userAgent: ctx.userAgent,
        slug: ctx.slug ?? null,
        articleTitle: json?.articleTitle ?? null,
        // The share-post markers are a rubric-relevant signal; flag them so a
        // grader can see at a glance which turns carried one.
        hasShareBlock: /\[SHARE\][\s\S]*\[\/SHARE\]/.test(reply),
        wordCount: countWords(reply),
        ...(status !== 200 ? { error: json?.error ?? text.slice(0, 500) } : {}),
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      text: '',
      latencyMs: 0,
      log: { endpoint, error: err?.message ?? 'network error', userAgent: ctx.userAgent },
    };
  }
}

/** The /open-source build assistant. */
async function sendOpenSourceTurn(
  ctx: DriverContext,
  message: string,
  history: ChatHistoryTurn[],
): Promise<SurfaceReply> {
  const endpoint = `${ctx.origin}/api/open-source/chat`;
  try {
    const { status, json, text, ms } = await postJSON(
      endpoint,
      {
        message,
        history,
        recipeIds: ctx.recipeIds ?? [],
        model: ctx.surfaceModel ?? 'sonnet-5',
      },
      ctx.userAgent,
    );
    const reply = json?.reply ?? '';
    return {
      ok: status === 200 && Boolean(reply),
      text: reply,
      latencyMs: ms,
      log: {
        endpoint,
        status,
        userAgent: ctx.userAgent,
        surfaceModel: json?.model ?? ctx.surfaceModel ?? 'sonnet-5',
        turnsLeft: json?.turnsLeft ?? null,
        // Rubric rows ask whether a ZIP was actually offered — record it.
        zipProposed: Boolean(json?.zipProposal),
        zipFileCount: json?.zipProposal?.files?.length ?? 0,
        zipFiles: json?.zipProposal?.files?.map((f: any) => f.path) ?? [],
        codeBlocks: (reply.match(/```/g)?.length ?? 0) / 2,
        wordCount: countWords(reply),
        ...(status !== 200 ? { error: json?.error ?? text.slice(0, 500) } : {}),
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      text: '',
      latencyMs: 0,
      log: { endpoint, error: err?.message ?? 'network error', userAgent: ctx.userAgent },
    };
  }
}

export async function sendSurfaceTurn(
  surface: EvalSurface,
  ctx: DriverContext,
  message: string,
  history: ChatHistoryTurn[],
): Promise<SurfaceReply> {
  if (surface === 'article-agent') return sendArticleTurn(ctx, message, history);
  if (surface === 'open-source') return sendOpenSourceTurn(ctx, message, history);
  throw new Error(`Surface "${surface}" is not conversational.`);
}

/**
 * Audio summaries aren't a conversation, so a persona chat would tell us
 * nothing. Instead we run the probe the rubric actually asks about: generate
 * once (expect a cache MISS), immediately request the same story again (expect
 * a HIT), then request it through the Instagram in-app user-agent (expect a
 * HIT — in-app readers should never pay for a TTS round-trip).
 *
 * The summary text rides back on the X-Summary header, which is what the
 * content and tone rows get graded against.
 */
export async function runAudioProbe(
  ctx: DriverContext,
): Promise<{ text: string; latencyMs: number; log: Record<string, any>; label: string }[]> {
  const endpoint = `${ctx.origin}/api/demeter/article-summary-audio`;
  const probes: { label: string; userAgent: string }[] = [
    { label: 'First request (cold — expect cache MISS)', userAgent: ctx.userAgent },
    { label: 'Immediate repeat (expect cache HIT)', userAgent: ctx.userAgent },
    { label: 'Instagram in-app browser (expect cache HIT)', userAgent: INSTAGRAM_USER_AGENT },
  ];

  const out = [];
  for (const probe of probes) {
    const started = Date.now();
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': probe.userAgent },
        body: JSON.stringify({ slug: ctx.slug }),
        cache: 'no-store',
      });
      const ms = Date.now() - started;
      const cache = res.headers.get('X-Audio-Cache');
      const rawSummary = res.headers.get('X-Summary');
      const summary = rawSummary ? safeDecode(rawSummary) : '';
      const audioBytes = res.ok ? (await res.arrayBuffer()).byteLength : 0;
      const errorBody = res.ok ? null : (await res.text()).slice(0, 500);

      out.push({
        label: probe.label,
        text: summary,
        latencyMs: ms,
        log: {
          endpoint,
          status: res.status,
          userAgent: probe.userAgent,
          slug: ctx.slug ?? null,
          cache,
          audioBytes,
          contentType: res.headers.get('Content-Type'),
          wordCount: countWords(summary),
          ...(errorBody ? { error: errorBody } : {}),
        },
      });
    } catch (err: any) {
      out.push({
        label: probe.label,
        text: '',
        latencyMs: Date.now() - started,
        log: { endpoint, error: err?.message ?? 'network error', userAgent: probe.userAgent },
      });
    }
  }
  return out;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
