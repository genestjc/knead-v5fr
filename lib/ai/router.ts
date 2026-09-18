/**
 * Shared AI clients + provider routing for Knead.
 *
 * Routing — each surface runs on the model whose strengths match it, and the
 * pairing is chosen here rather than by callers (see MODEL_PROFILES):
 * - Claude Opus (claude-opus-4-8) — editorial voice and judgment: article
 *   summaries, the Demeter reader bubble, the Probatio judges. Low volume,
 *   quality-first.
 * - Claude Sonnet 5 (claude-sonnet-5) — the open-source build assistant and
 *   the Demeter community agent. High volume and retrieval-grounded (answers
 *   come from fetched repo files or articles), where Sonnet is near-Opus on
 *   coding at ~60% of the price and noticeably faster.
 * - OpenAI GPT-5.6 — the automatic fallback whenever a Claude call fails,
 *   tiered to match the surface it covers (route on the value of the
 *   decision, not the provider): Opus editorial surfaces fall back to Sol
 *   (flagship), Sonnet assistant surfaces to Terra (balanced), and a
 *   high-volume surface to Luna, the budget tier ($1/$6 vs the outgoing
 *   gpt-5's $1.25/$10 per M tokens; gpt-5 shuts down Dec 11, 2026). Fallback
 *   traffic only exists during Claude outages, so the pricier tiers cost
 *   nothing in normal operation.
 * - OpenAI also keeps TTS (gpt-4o-mini-tts — the GPT-Live voice models that
 *   shipped alongside 5.6 have no developer API yet) and the free
 *   Moderation API.
 *
 * The prompt cache is per-model, so keep each surface pinned to one profile
 * rather than switching per request.
 *
 * Tools are declared once in a provider-neutral shape and mapped to each
 * SDK's format, so the fallback path supports the same tool set.
 */
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export const CLAUDE_OPUS = 'claude-opus-4-8';
export const CLAUDE_SONNET = 'claude-sonnet-5';
export const OPENAI_SOL = 'gpt-5.6-sol';
export const OPENAI_TERRA = 'gpt-5.6-terra';
export const OPENAI_LUNA = 'gpt-5.6-luna';

export type Provider = 'claude' | 'openai';

/**
 * A surface picks a profile, not a model.
 *
 * Both providers have to be named for every surface, because either can be the
 * one serving the turn — Claude by default, OpenAI on fallback or when the
 * user picks it. Two separate options (a Claude model and an OpenAI model)
 * meant a caller could pair a cheap tier with an expensive one by forgetting
 * one of them, which is exactly what scripts/backfill-excerpts.ts did: Opus
 * primary, Luna fallback. Naming the pair once removes the failure.
 */
export type ModelProfile = 'editorial' | 'assistant' | 'high-volume';

export const MODEL_PROFILES: Record<ModelProfile, { claude: string; openai: string }> = {
  /** Voice and judgment: summaries, Demeter's reader bubble, Probatio judges. */
  editorial: { claude: CLAUDE_OPUS, openai: OPENAI_SOL },
  /** Retrieval-grounded assistants: the build chat, the Demeter chat agent. */
  assistant: { claude: CLAUDE_SONNET, openai: OPENAI_TERRA },
  /**
   * The budget pair. No surface runs on it today; it exists so that a
   * high-volume surface has a coherent pair to opt into rather than reaching
   * for a raw model string.
   */
  'high-volume': { claude: CLAUDE_SONNET, openai: OPENAI_LUNA },
};

/** The model a profile runs on for one provider — for labelling stored results. */
export function modelFor(profile: ModelProfile, provider: Provider): string {
  return MODEL_PROFILES[profile][provider];
}

/**
 * The provider clients, built on first use rather than on import.
 *
 * They used to be constructed at module scope, and the OpenAI SDK throws
 * `Missing credentials` from its constructor when there is no key. That turned
 * importing ANYTHING from this file into a hard requirement for a live
 * OPENAI_API_KEY — including importing a constant. The visible cost was that no
 * pure function in a module that touches the router could be unit-tested
 * without a key in the environment, and the workaround was to keep splitting
 * parsing logic into separate files to dodge the import. Building them lazily
 * removes the reason for those splits: a module can import `MAX_IMAGE_BYTES`
 * without standing up two SDK clients.
 *
 * Cached after the first call, so this is not a client per request.
 */
let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

export function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export interface AgentTool {
  name: string;
  description: string;
  /** JSON Schema describing the tool's arguments. */
  parameters: Record<string, unknown>;
  /**
   * May this run concurrently with the other tools in the same round?
   * Defaults to true, which is right for independent reads. Set false for a
   * tool whose result depends on, or is clobbered by, another call in the same
   * batch — the whole batch then runs in declaration order.
   */
  parallelSafe?: boolean;
  /**
   * Is running this a second time harmless? Defaults to true, which holds for
   * reads and for idempotent upserts. Set false for anything that must not
   * happen twice: once such a tool has run, a provider failure stops the turn
   * rather than replaying it from the top on the other provider.
   */
  replaySafe?: boolean;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Tool arguments arrive from a model, so they are only as trustworthy as the
 * model's schema compliance. The router shape-checks them against the declared
 * JSON Schema before an executor sees them (see validateToolArgs); `any` is
 * kept here because every executor immediately indexes named fields, and
 * narrowing at ~40 call sites would buy no runtime safety over that check.
 */
export type ToolExecutor = (
  name: string,
  args: any,
  ctx?: { signal?: AbortSignal },
) => Promise<string>;

// Cost controls. Tool results (fetched source files can be huge) and client
// history are the two unbounded inputs; everything else is capped by design.
// The per-result cap is sized to clear lib/github.ts's CHAT_MAX_FILE_BYTES
// (12 KB) plus the header and markers wrapped around fetched source; the
// per-request cap stops a five-round loop from stacking five of those.
const MAX_TOOL_RESULT_CHARS = 16_000;
const MAX_TOTAL_TOOL_RESULT_CHARS = 60_000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS = 24_000;

/**
 * How long one tool call may run before it comes back as a tool error.
 *
 * None of the tool implementations set a deadline of their own, so a GitHub
 * fetch that never resolves holds the whole turn — and the surfaces that use
 * tools die at 60s of function time anyway. A tool that times out is reported
 * to the model like any other tool failure, so the turn still produces an
 * answer. (Provider requests keep each SDK's own default unless a caller sets
 * requestTimeoutMs: the Probatio judges legitimately run for minutes.)
 */
const DEFAULT_TOOL_TIMEOUT_MS = 30_000;

/**
 * Truncate from the middle, not the tail.
 *
 * Fetched source arrives wrapped in lib/github.ts's BEGIN/END VERBATIM SOURCE
 * markers, and a line-range read is bounded in lines rather than characters —
 * 400 long lines clear this cap. Cutting only the head kept the opening marker
 * and dropped the closing one, which loses the boundary between real repo code
 * and the model's own text: the exact confusion that produces "here's the real
 * file" over code nobody fetched. Keeping both ends preserves the frame.
 */
export function truncateToolResult(text: string, limit = MAX_TOOL_RESULT_CHARS): string {
  if (text.length <= limit) return text;
  const removed = text.length - limit;
  const notice = `\n\n[Truncated — ${removed.toLocaleString()} characters were removed from the middle of this result, so the section below is not continuous with the section above. Treat what you have as two excerpts, say so if you show them, and request a narrower file or line range if you need the rest.]\n\n`;
  const body = Math.max(0, limit - notice.length);
  // Weighted to the head: a file's imports and top-level shape explain more
  // than its last lines, but the tail has to survive for the closing marker.
  const head = Math.ceil(body * 0.7);
  const tail = body - head;
  return text.slice(0, head) + notice + (tail > 0 ? text.slice(text.length - tail) : '');
}

// Sent when tool rounds run out mid-task. Without this the model doesn't know
// its tools are gone and starts writing tool calls as literal text ("Calling
// get_source_file for…"), narrating retries at the user.
const WRAP_UP_INSTRUCTION =
  "You've reached this turn's tool limit — tools are no longer available. Write your reply now from what you've already retrieved. Do not mention tools, fetching, retrying, or any issue; never write a tool call as text. If more lookups would help, end by offering them as the next step.";

export interface AgentChatOptions {
  system: string;
  history?: ChatTurn[];
  message: string;
  tools?: AgentTool[];
  executeTool?: ToolExecutor;
  /**
   * The visible-answer budget, in tokens. Claude takes it as max_tokens with
   * thinking off, so it is the literal cap. OpenAI's 5.6 family bills
   * reasoning against the same allowance even at effort 'none', so the router
   * asks for headroom there (see runOpenAILoop) — it is a cap, not a
   * reservation, so the headroom is free unless it is used.
   */
  maxTokens: number;
  maxRounds?: number;
  /**
   * The paired Claude/OpenAI tiers for this surface. Defaults to 'editorial'.
   */
  profile?: ModelProfile;
  /**
   * Which provider to try first; the other one is the automatic fallback.
   * Defaults to Claude. The open-source chat passes this through from the
   * user-facing model picker.
   */
  preferredProvider?: Provider;
  /**
   * Images to send alongside `message`, as base64.
   *
   * Added for the social audit, where a screenshot is the only way to read an
   * Instagram or X post at all — both platforms wall their content off from
   * unauthenticated requests, so a person looking at their own screen and
   * handing it over is the path that works. It also carries more than the API
   * would: a screenshot has the photograph in it, and the photograph is half
   * of why an Instagram post works.
   *
   * Both providers take images only on the current user turn, which is all
   * this is used for. History stays text.
   */
  images?: ImageInput[];
  /** Cancels provider requests and tool calls. */
  signal?: AbortSignal;
  /** Per-provider-request deadline. Defaults to two minutes. */
  requestTimeoutMs?: number;
  /** Per-tool-call deadline. Defaults to 30 seconds. */
  toolTimeoutMs?: number;
  /** Prefix for error logs, e.g. 'Demeter' or 'build/chat'. */
  logTag: string;
}

export interface ImageInput {
  /** Base64 WITHOUT the data: URL prefix. */
  data: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
}

/**
 * Per-request image cap.
 *
 * Anthropic rejects oversized images outright, and a rejection here loses the
 * whole judging run rather than one screenshot — so the caller is told which
 * image is too big and by how much, in a message a person can act on, before
 * anything is sent.
 */
export const MAX_IMAGE_BYTES = 5_000_000;
/**
 * 20, not 8.
 *
 * Eight was a conservative guess made when the only input was someone pasting
 * a screenshot or two. The social audit changed the shape of the request: a
 * screen recording of a Story sequence or a scroll through a competitor's grid
 * gets sampled into frames, and four frames of a sixty-second recording is a
 * different post from the one that was filmed. Both providers accept far more
 * than twenty; the real ceiling is the per-request token budget, and twenty
 * frames at thumbnail width sits well inside it.
 */
export const MAX_IMAGES_PER_REQUEST = 20;
/**
 * Total decoded image bytes in one request.
 *
 * The per-image and per-count caps multiply: twenty images at 5MB each is a
 * 100MB payload before base64 inflates it by a third, which no provider will
 * take and no serverless function should try to hold. 20MB sits under
 * Anthropic's 32MB request ceiling and is far above what a real audit sends
 * (twenty screenshots fitted to 1600px land near 4MB).
 */
export const MAX_TOTAL_IMAGE_BYTES = 20_000_000;

/** Decoded byte length of a base64 payload, without materialising it. */
function base64Bytes(data: string): number {
  if (!data) return 0;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

/**
 * Validate images before they reach a provider.
 *
 * Returns the problems rather than throwing: a caller judging four screenshots
 * would rather drop the one that is unreadable and grade the other three than
 * lose the run. runAgentChat runs the same check as a last boundary and does
 * throw, so a caller that forgets fails here rather than at the provider.
 */
export function checkImages(images: ImageInput[]): string[] {
  const problems: string[] = [];
  if (images.length > MAX_IMAGES_PER_REQUEST) {
    problems.push(
      `${images.length} images were supplied; at most ${MAX_IMAGES_PER_REQUEST} can be sent at once.`,
    );
  }
  let total = 0;
  images.forEach((image, i) => {
    // base64 carries ~4 chars per 3 bytes; decode the length rather than
    // measuring the string, or a 4MB image reads as 5.3MB and gets refused.
    const bytes = base64Bytes(image.data);
    total += bytes;
    if (bytes > MAX_IMAGE_BYTES) {
      problems.push(
        `Image ${i + 1} is ${(bytes / 1_000_000).toFixed(1)}MB, over the ${MAX_IMAGE_BYTES / 1_000_000}MB limit. Resize or re-crop it.`,
      );
    }
    if (!image.data) problems.push(`Image ${i + 1} is empty.`);
  });
  if (total > MAX_TOTAL_IMAGE_BYTES) {
    problems.push(
      `These images total ${(total / 1_000_000).toFixed(1)}MB, over the ${MAX_TOTAL_IMAGE_BYTES / 1_000_000}MB one request can carry. Send fewer, or resize them.`,
    );
  }
  return problems;
}

// ---------- observability ----------

/**
 * One line per turn, so degradation is countable rather than anecdotal.
 *
 * Emitted on stdout as JSON: a fallback that fires on every request, a tool
 * result truncated on every round, or a surface that quietly needs a forced
 * synthesis to say anything are all invisible until someone can group by tag.
 */
export interface RouterEvent {
  tag: string;
  profile: ModelProfile;
  provider: Provider;
  model: string;
  outcome: 'ok' | 'empty' | 'error';
  rounds: number;
  toolCalls: number;
  toolErrors: number;
  truncatedResults: number;
  forcedSynthesis: boolean;
  /** A tool that must not run twice has run. */
  replayUnsafe: boolean;
  replyChars: number;
  ms: number;
  stopReason?: string | null;
  error?: string;
  failover?: 'none' | 'used' | 'suppressed-deterministic' | 'suppressed-side-effect' | 'aborted';
}

function logRouterEvent(event: RouterEvent): void {
  const line = `[router] ${JSON.stringify(event)}`;
  if (event.outcome === 'ok') console.log(line);
  else console.error(line);
}

interface RunState {
  model: string;
  rounds: number;
  toolCalls: number;
  toolErrors: number;
  truncatedResults: number;
  toolResultChars: number;
  forcedSynthesis: boolean;
  replayUnsafe: boolean;
  stopReason: string | null;
}

function newRunState(model: string): RunState {
  return {
    model,
    rounds: 0,
    toolCalls: 0,
    toolErrors: 0,
    truncatedResults: 0,
    toolResultChars: 0,
    forcedSynthesis: false,
    replayUnsafe: false,
    stopReason: null,
  };
}

// ---------- failure classification ----------

function statusOf(err: any): number | undefined {
  return err?.status ?? err?.statusCode ?? err?.response?.status;
}

/**
 * Is this a request we built wrong, rather than a provider having a bad day?
 *
 * A 400/413/422 is deterministic: a malformed tool schema, a context overflow,
 * an oversized image. Sending the same request to the other provider costs a
 * second full round-trip and fails the same way, so it surfaces instead.
 *
 * 401/403 deliberately do NOT count. A missing or revoked key for one provider
 * is precisely the outage the second provider exists to cover, and 404 usually
 * means a model id was retired — also worth trying elsewhere.
 */
export function isDeterministicRequestError(err: any): boolean {
  const status = statusOf(err);
  if (status === 400 || status === 413 || status === 422) return true;
  const type = err?.error?.type ?? err?.type;
  return typeof type === 'string' && type.includes('invalid_request');
}

function isAbort(err: any): boolean {
  return err?.name === 'AbortError' || err?.name === 'TimeoutError';
}

// ---------- tool execution ----------

interface PendingToolCall {
  id: string;
  name: string;
  /** A JSON string from OpenAI, an already-parsed object from Claude. */
  rawArgs: unknown;
}

interface ToolContext {
  tools: AgentTool[];
  executeTool: ToolExecutor;
  state: RunState;
  signal?: AbortSignal;
  toolTimeoutMs: number;
  logTag: string;
}

function jsonTypeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * A shape check against the declared schema, not a full JSON Schema validator.
 *
 * It catches what models actually get wrong — a missing required field, a
 * number sent as a string, an enum value invented on the spot — before the
 * executor indexes into the object and fails somewhere less explainable.
 * Returns a sentence the model can act on, or null when the args are usable.
 */
export function validateToolArgs(tool: AgentTool, args: unknown): string | null {
  if (jsonTypeOf(args) !== 'object') {
    return `arguments must be a JSON object, not ${jsonTypeOf(args)}`;
  }
  const record = args as Record<string, unknown>;
  const schema = tool.parameters ?? {};
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  const missing = required.filter((key) => record[key] === undefined || record[key] === null);
  if (missing.length > 0) {
    return `missing required argument${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`;
  }

  const properties = (schema.properties ?? {}) as Record<string, any>;
  for (const [key, value] of Object.entries(record)) {
    const spec = properties[key];
    if (!spec || value === undefined || value === null) continue;
    const expected: string | undefined = spec.type;
    const actual = jsonTypeOf(value);
    if (expected === 'integer') {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return `"${key}" must be an integer, not ${actual}`;
      }
    } else if (expected && expected !== actual) {
      // JSON Schema's "number" accepts integers; everything else is exact.
      if (!(expected === 'number' && actual === 'number')) {
        return `"${key}" must be ${expected}, not ${actual}`;
      }
    }
    if (Array.isArray(spec.enum) && !spec.enum.includes(value)) {
      return `"${key}" must be one of: ${spec.enum.join(', ')}`;
    }
  }
  return null;
}

/**
 * What the model is told when a tool did not run.
 *
 * Deliberately short and generic. Raw executor errors carry Supabase table
 * names, request URLs, file paths and stack detail, and everything in this
 * string is context the model may quote back to a user — so the detail is
 * logged server-side and the model gets the fact plus the way forward.
 */
function toolErrorText(name: string, reason: string): string {
  return `Tool error: ${name} did not run — ${reason}. You have no result from it: do not describe what it would have returned. Fix the call and try once more, or answer from what you already have and say that lookup didn't work.`;
}

function describeFailure(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (/abort|timeout|timed out/i.test(raw)) return 'it timed out';
  if (/rate.?limit|\b429\b/i.test(raw)) return 'the underlying service is rate-limiting us';
  if (/\b(401|403)\b|permission|denied|unauthorized/i.test(raw)) return 'access was refused';
  if (/fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|network/i.test(raw)) return 'the network call failed';
  return 'it failed';
}

/** Per-result and per-request truncation, with both counted for the event log. */
function budgetToolResult(result: string, state: RunState): string {
  // An executor that returns nothing would otherwise become an empty
  // tool_result block, which Anthropic rejects — losing the round to a 400.
  const text = typeof result === 'string' && result.length > 0 ? result : '(the tool returned no output)';
  const remaining = MAX_TOTAL_TOOL_RESULT_CHARS - state.toolResultChars;
  if (remaining <= 0) {
    state.truncatedResults++;
    return '[Dropped — this turn has already used its whole tool-output budget. Answer from what you have retrieved so far and say that you could not read more.]';
  }
  const limit = Math.min(MAX_TOOL_RESULT_CHARS, remaining);
  const out = truncateToolResult(text, limit);
  if (out.length < text.length) state.truncatedResults++;
  state.toolResultChars += out.length;
  return out;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runOneToolCall(call: PendingToolCall, ctx: ToolContext): Promise<string> {
  const tool = ctx.tools.find((t) => t.name === call.name);
  if (!tool) {
    ctx.state.toolErrors++;
    return toolErrorText(call.name, 'there is no tool by that name in this turn');
  }

  let args: unknown;
  if (typeof call.rawArgs === 'string') {
    // A model can emit arguments that are not JSON at all. Parsing this inline
    // used to throw out of the round's Promise.all, which failed the whole
    // provider loop and handed the turn to the other provider — a cross-provider
    // failover over one bad tool call. It belongs to the model to fix, so it
    // goes back as a tool result.
    try {
      args = JSON.parse(call.rawArgs || '{}');
    } catch {
      ctx.state.toolErrors++;
      return toolErrorText(call.name, 'its arguments were not valid JSON');
    }
  } else {
    args = call.rawArgs ?? {};
  }

  const invalid = validateToolArgs(tool, args);
  if (invalid) {
    ctx.state.toolErrors++;
    return toolErrorText(call.name, invalid);
  }

  ctx.state.toolCalls++;
  // Set before execution, not after: a call that throws may still have landed.
  if (tool.replaySafe === false) ctx.state.replayUnsafe = true;

  try {
    const result = await withTimeout(
      ctx.executeTool(call.name, args, { signal: ctx.signal }),
      ctx.toolTimeoutMs,
      call.name,
    );
    return budgetToolResult(result, ctx.state);
  } catch (err) {
    ctx.state.toolErrors++;
    console.error(
      `[${ctx.logTag}] tool ${call.name} failed:`,
      err instanceof Error ? err.message : err,
    );
    return toolErrorText(call.name, describeFailure(err));
  }
}

/**
 * Run one round's tool calls.
 *
 * Parallel by default — a round is usually two independent source-file reads,
 * and running those in series doubles the wait for no reason. A batch holding
 * any tool marked `parallelSafe: false` runs in declaration order instead.
 */
async function runToolCalls(
  calls: PendingToolCall[],
  ctx: ToolContext,
): Promise<{ id: string; content: string }[]> {
  const mustSerialize = calls.some(
    (call) => ctx.tools.find((t) => t.name === call.name)?.parallelSafe === false,
  );
  if (mustSerialize) {
    const out: { id: string; content: string }[] = [];
    for (const call of calls) {
      out.push({ id: call.id, content: await runOneToolCall(call, ctx) });
    }
    return out;
  }
  return Promise.all(
    calls.map(async (call) => ({ id: call.id, content: await runOneToolCall(call, ctx) })),
  );
}

// ---------- entry points ----------

/**
 * Run a (possibly tool-using) chat turn on the preferred provider, falling
 * back to the other one if the call fails. Returns the assistant's final text.
 *
 * Fallback replays the turn from the original conversation state, so it is
 * only safe while every tool that ran can run again. Once a tool declared
 * `replaySafe: false` has executed, the failure surfaces instead of being
 * retried on the other provider.
 */
export async function runAgentChat(opts: AgentChatOptions): Promise<string> {
  // The last boundary, not the only one: callers still preflight so a person
  // gets a useful message about which screenshot was too big, but a caller
  // that forgets fails here rather than at the provider.
  if (opts.images?.length) {
    const problems = checkImages(opts.images);
    if (problems.length > 0) {
      throw new Error(`Images cannot be sent: ${problems.join(' ')}`);
    }
  }

  const profile = opts.profile ?? 'editorial';
  const preferred: Provider = opts.preferredProvider === 'openai' ? 'openai' : 'claude';
  const other: Provider = preferred === 'claude' ? 'openai' : 'claude';

  const attempt = async (provider: Provider) => {
    const state = newRunState(modelFor(profile, provider));
    const started = Date.now();
    const run = provider === 'claude' ? runClaudeLoop : runOpenAILoop;
    try {
      const reply = await run(opts, state, profile);
      return { state, reply, started, error: undefined as any };
    } catch (err) {
      return { state, reply: '', started, error: err };
    }
  };

  const emit = (
    provider: Provider,
    r: { state: RunState; reply: string; started: number; error?: any },
    failover: RouterEvent['failover'],
  ) => {
    logRouterEvent({
      tag: opts.logTag,
      profile,
      provider,
      model: r.state.model,
      outcome: r.error ? 'error' : r.reply ? 'ok' : 'empty',
      rounds: r.state.rounds,
      toolCalls: r.state.toolCalls,
      toolErrors: r.state.toolErrors,
      truncatedResults: r.state.truncatedResults,
      forcedSynthesis: r.state.forcedSynthesis,
      replayUnsafe: r.state.replayUnsafe,
      replyChars: r.reply.length,
      ms: Date.now() - r.started,
      stopReason: r.state.stopReason,
      ...(r.error ? { error: String(r.error?.message ?? r.error) } : {}),
      failover,
    });
  };

  const first = await attempt(preferred);

  if (!first.error && first.reply) {
    emit(preferred, first, 'none');
    return first.reply;
  }

  // Cancellation is the caller's decision or a deadline we set; a second full
  // turn on the other provider would blow straight through it.
  if (first.error && isAbort(first.error)) {
    emit(preferred, first, 'aborted');
    throw first.error;
  }
  if (first.error && isDeterministicRequestError(first.error)) {
    emit(preferred, first, 'suppressed-deterministic');
    throw first.error;
  }
  // Retrying on the other provider replays the turn from the original state,
  // which re-runs every tool that already ran. That is only wasted work for
  // reads, so it is allowed — but never once a tool that must not happen twice
  // has executed.
  if (first.state.replayUnsafe) {
    emit(preferred, first, 'suppressed-side-effect');
    if (first.error) throw first.error;
    return first.reply;
  }

  emit(preferred, first, 'used');

  const second = await attempt(other);
  emit(other, second, 'none');
  if (second.error) throw second.error;
  return second.reply;
}

/** One-shot text generation (no tools) with the same Claude→GPT-5.6 fallback. */
export async function generateText(opts: {
  system: string;
  prompt: string;
  maxTokens: number;
  logTag: string;
  /** Paired tiers for this surface — see AgentChatOptions.profile. */
  profile?: ModelProfile;
  signal?: AbortSignal;
}): Promise<string> {
  return runAgentChat({
    system: opts.system,
    message: opts.prompt,
    maxTokens: opts.maxTokens,
    maxRounds: 1,
    profile: opts.profile,
    signal: opts.signal,
    logTag: opts.logTag,
  });
}

/**
 * Cap history by message count AND by size, then drop any leading assistant
 * greeting — the Messages API requires the first turn to be from the user.
 *
 * Twelve messages of pasted stack traces is a different request from twelve
 * messages of chat, and only one of them fits a budget. Oldest go first; the
 * newest message is always kept even if it alone is over the char budget.
 */
export function sanitizeHistory(history: ChatTurn[] = []): ChatTurn[] {
  const recent = history.slice(-MAX_HISTORY_MESSAGES);
  let total = recent.reduce((sum, m) => sum + m.content.length, 0);
  let start = 0;
  while (start < recent.length - 1 && total > MAX_HISTORY_CHARS) {
    total -= recent[start].content.length;
    start++;
  }
  const trimmed = recent.slice(start);
  const firstUser = trimmed.findIndex((m) => m.role === 'user');
  return firstUser === -1 ? [] : trimmed.slice(firstUser);
}

/**
 * Mark the last content block of the last message as a cache breakpoint, so
 * each round of a tool loop (and each follow-up turn within the 5-minute cache
 * TTL) reads the growing conversation prefix at the cached rate.
 *
 * Only worth doing when a loop can actually happen. A cache write costs 25%
 * over base input, and on a one-shot call — a judge, a summary — the prefix it
 * writes is a prompt that will never be sent again, so the surcharge buys
 * nothing. The system prompt keeps its own breakpoint either way: that one IS
 * identical across calls.
 *
 * Typed to the block kinds that can actually be last here — text on a user
 * turn, image when a turn is images-only, tool_result on a tool round. All
 * three accept cache_control; thinking blocks do not, and cannot appear,
 * since thinking is disabled and assistant turns are never last at call time.
 */
type CacheableBlock =
  | Anthropic.TextBlockParam
  | Anthropic.ImageBlockParam
  | Anthropic.ToolResultBlockParam;

function withCacheBreakpoint(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const last = messages[messages.length - 1];
  if (!last) return messages;
  const blocks: Anthropic.ContentBlockParam[] =
    typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : [...last.content];
  if (blocks.length === 0) return messages;

  const tail = blocks[blocks.length - 1];
  if (tail.type !== 'text' && tail.type !== 'image' && tail.type !== 'tool_result') {
    return messages;
  }
  const cached: CacheableBlock = { ...(tail as CacheableBlock), cache_control: { type: 'ephemeral' } };
  blocks[blocks.length - 1] = cached;
  return [...messages.slice(0, -1), { ...last, content: blocks }];
}

async function runClaudeLoop(
  opts: AgentChatOptions,
  state: RunState,
  profile: ModelProfile,
): Promise<string> {
  const { system, message, tools = [], executeTool, maxTokens, maxRounds = 5 } = opts;
  const model = modelFor(profile, 'claude');
  const requestOptions = {
    signal: opts.signal,
    ...(opts.requestTimeoutMs ? { timeout: opts.requestTimeoutMs } : {}),
  };

  // Prompt caching: tool schemas and the system prompt are identical on every
  // round and every turn, so cache them (90% input discount on hits). One
  // breakpoint after the last tool covers the whole tool block; one after the
  // system prompt covers both.
  const claudeTools: Anthropic.Tool[] = tools.map((t, i) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
    ...(i === tools.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
  }));

  const cachedSystem: Anthropic.TextBlockParam[] = [
    { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
  ];

  // Images ride on the current user turn only. Text goes LAST: a model shown
  // the instruction before the images tends to answer from the instruction and
  // skim what it was given, which for a judging pass means grading a post it
  // barely looked at.
  const userContent: Anthropic.ContentBlockParam[] | string = opts.images?.length
    ? [
        ...opts.images.map(
          (image): Anthropic.ImageBlockParam => ({
            type: 'image',
            source: { type: 'base64', media_type: image.mediaType, data: image.data },
          }),
        ),
        { type: 'text', text: message },
      ]
    : message;

  const messages: Anthropic.MessageParam[] = [
    ...sanitizeHistory(opts.history).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userContent },
  ];

  // Chat surfaces are latency-sensitive, so thinking stays off. This must be
  // explicit: Sonnet 5 runs adaptive thinking by default when the field is
  // omitted, and thinking tokens draw from max_tokens — a tight budget can
  // come back as all thinking and no visible text.
  const thinking = { type: 'disabled' as const };
  const canLoop = claudeTools.length > 0 && !!executeTool;

  // Collect text from EVERY round, not just the last one. The model often
  // writes user-facing text (a greeting, a question) in the same round as a
  // tool call, then adds only a short closing line after the result comes
  // back — overwriting per round shipped just the closer and dropped the rest.
  const textParts: string[] = [];
  let pendingToolResults = false;

  for (let round = 0; round < maxRounds; round++) {
    pendingToolResults = false;
    state.rounds++;
    const response = await getAnthropic().messages.create(
      {
        model,
        max_tokens: maxTokens,
        thinking,
        system: cachedSystem,
        messages: canLoop ? withCacheBreakpoint(messages) : messages,
        ...(claudeTools.length > 0 ? { tools: claudeTools } : {}),
      },
      requestOptions,
    );
    state.stopReason = response.stop_reason;

    messages.push({ role: 'assistant', content: response.content });

    const roundText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (roundText) textParts.push(roundText);

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (toolUses.length === 0 || !executeTool) break;

    const outcomes = await runToolCalls(
      toolUses.map((u) => ({ id: u.id, name: u.name, rawArgs: u.input })),
      {
        tools,
        executeTool,
        state,
        signal: opts.signal,
        toolTimeoutMs: opts.toolTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS,
        logTag: opts.logTag,
      },
    );

    messages.push({
      role: 'user',
      content: outcomes.map(
        (o): Anthropic.ToolResultBlockParam => ({
          type: 'tool_result',
          tool_use_id: o.id,
          content: o.content,
        }),
      ),
    });
    pendingToolResults = true;
  }

  // The loop ended holding tool results nobody has read — the model spent its
  // last round asking for data and never saw it. One more call, without tools,
  // turns that data into an answer.
  //
  // This does NOT depend on whether earlier rounds produced text: text written
  // before the final results is a progress note ("let me check the auth route"),
  // and shipping it as the answer meant shipping a conclusion drawn without the
  // thing that was fetched.
  if (pendingToolResults) {
    state.forcedSynthesis = true;
    const final = await getAnthropic().messages.create(
      {
        model,
        max_tokens: maxTokens,
        thinking,
        system: cachedSystem,
        // Consecutive user messages are combined into one turn by the API
        messages: [...messages, { role: 'user', content: WRAP_UP_INSTRUCTION }],
      },
      requestOptions,
    );
    const finalText = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    // The synthesis answers from the whole transcript, so it replaces the
    // progress notes rather than being appended to them — unless it came back
    // empty, in which case the progress notes are all there is.
    if (finalText) return finalText;
  }

  const reply = textParts.join('\n\n');
  if (!reply) {
    console.error(
      `[${opts.logTag}] Claude reply empty (stop_reason=${state.stopReason}, rounds=${state.rounds}, toolCalls=${state.toolCalls}, toolErrors=${state.toolErrors})`,
    );
  }
  return reply;
}

async function runOpenAILoop(
  opts: AgentChatOptions,
  state: RunState,
  profile: ModelProfile,
): Promise<string> {
  const { system, message, tools = [], executeTool, maxTokens, maxRounds = 5 } = opts;
  const model = modelFor(profile, 'openai');
  const requestOptions = {
    signal: opts.signal,
    ...(opts.requestTimeoutMs ? { timeout: opts.requestTimeoutMs } : {}),
  };
  // GPT-5.6 is a reasoning model: it takes max_completion_tokens (not
  // max_tokens), and reasoning tokens draw from that same budget even at
  // effort 'none', so keep headroom. It caps what may be generated rather than
  // reserving it, so the headroom is free unless the model uses it.
  const completionTokens = Math.max(maxTokens * 3, 4096);

  const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...sanitizeHistory(opts.history).map((m) => ({ role: m.role, content: m.content })),
    opts.images?.length
      ? {
          role: 'user' as const,
          content: [
            ...opts.images.map((image) => ({
              type: 'image_url' as const,
              image_url: { url: `data:${image.mediaType};base64,${image.data}` },
            })),
            { type: 'text' as const, text: message },
          ],
        }
      : { role: 'user' as const, content: message },
  ];

  // Same as the Claude loop: keep text from every round, since text sent
  // alongside tool calls is part of the reply too.
  const textParts: string[] = [];
  let pendingToolResults = false;

  for (let round = 0; round < maxRounds; round++) {
    pendingToolResults = false;
    state.rounds++;
    const response = await getOpenAI().chat.completions.create(
      {
        model,
        max_completion_tokens: completionTokens,
        // Effort must be 'none' here: on the 5.6 family, Chat Completions
        // rejects function tools combined with any other reasoning_effort
        // ("… not supported … use /v1/responses"). That matches the Claude
        // loop anyway — chat surfaces are latency-sensitive.
        reasoning_effort: 'none',
        ...(openaiTools.length > 0 ? { tools: openaiTools } : {}),
        messages,
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      requestOptions,
    );
    state.stopReason = response.choices[0].finish_reason;

    const assistantMessage = response.choices[0].message;
    messages.push(assistantMessage);

    const roundText = assistantMessage.content?.trim();
    if (roundText) textParts.push(roundText);

    // SDK v6 types tool_calls as function-or-custom tool calls; we only
    // declare function tools, so narrow before reading .function.
    const toolCalls = (assistantMessage.tool_calls ?? []).filter(
      (t): t is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall =>
        t.type === 'function',
    );
    if (toolCalls.length === 0 || !executeTool) break;

    const outcomes = await runToolCalls(
      toolCalls.map((t) => ({ id: t.id, name: t.function.name, rawArgs: t.function.arguments })),
      {
        tools,
        executeTool,
        state,
        signal: opts.signal,
        toolTimeoutMs: opts.toolTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS,
        logTag: opts.logTag,
      },
    );

    messages.push(
      ...outcomes.map((o) => ({
        role: 'tool' as const,
        tool_call_id: o.id,
        content: o.content,
      })),
    );
    pendingToolResults = true;
  }

  // See the Claude loop: results the model never got to read are worth one
  // more call, whether or not it wrote anything earlier.
  if (pendingToolResults) {
    state.forcedSynthesis = true;
    const final = await getOpenAI().chat.completions.create(
      {
        model,
        max_completion_tokens: completionTokens,
        reasoning_effort: 'none',
        messages: [...messages, { role: 'system', content: WRAP_UP_INSTRUCTION }],
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      requestOptions,
    );
    const finalText = final.choices[0].message.content?.trim();
    if (finalText) return finalText;
  }

  const reply = textParts.join('\n\n');
  if (!reply) {
    console.error(
      `[${opts.logTag}] GPT-5.6 reply empty (finish_reason=${state.stopReason}, rounds=${state.rounds}, toolCalls=${state.toolCalls}, toolErrors=${state.toolErrors})`,
    );
  }
  return reply;
}
