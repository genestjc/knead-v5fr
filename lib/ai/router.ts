/**
 * Shared AI clients + provider routing for Knead.
 *
 * Routing:
 * - Claude Opus (claude-opus-4-8) — editorial text: article summaries, the
 *   Demeter reader bubble, and the open-source build assistant.
 * - OpenAI GPT-5 (gpt-5) — the Towns community-chat agent, and the automatic
 *   fallback whenever a Claude call fails.
 * - OpenAI also keeps TTS (gpt-4o-mini-tts) and the free Moderation API.
 *
 * Tools are declared once in a provider-neutral shape and mapped to each
 * SDK's format, so the fallback path supports the same tool set.
 */
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export const CLAUDE_MODEL = 'claude-opus-4-8';
export const OPENAI_FALLBACK_MODEL = 'gpt-5';

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AgentTool {
  name: string;
  description: string;
  /** JSON Schema describing the tool's arguments. */
  parameters: Record<string, unknown>;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type ToolExecutor = (name: string, args: any) => Promise<string>;

export interface AgentChatOptions {
  system: string;
  history?: ChatTurn[];
  message: string;
  tools?: AgentTool[];
  executeTool?: ToolExecutor;
  maxTokens: number;
  maxRounds?: number;
  /** Prefix for error logs, e.g. 'Demeter' or 'build/chat'. */
  logTag: string;
}

/**
 * Run a (possibly tool-using) chat turn on Claude Opus, falling back to
 * OpenAI GPT-5 if the Claude call fails. Returns the assistant's final text.
 */
export async function runAgentChat(opts: AgentChatOptions): Promise<string> {
  try {
    return await runClaudeLoop(opts);
  } catch (err: any) {
    console.error(
      `[${opts.logTag}] Claude error (${err?.message}); falling back to ${OPENAI_FALLBACK_MODEL}`,
    );
    return runOpenAILoop(opts);
  }
}

/** One-shot text generation (no tools) with the same Claude→GPT-5 fallback. */
export async function generateText(opts: {
  system: string;
  prompt: string;
  maxTokens: number;
  logTag: string;
}): Promise<string> {
  return runAgentChat({
    system: opts.system,
    message: opts.prompt,
    maxTokens: opts.maxTokens,
    maxRounds: 1,
    logTag: opts.logTag,
  });
}

// The Messages API requires the first turn to be from the user, so drop any
// leading assistant greeting the client may have included in history.
function sanitizeHistory(history: ChatTurn[] = []): ChatTurn[] {
  const firstUser = history.findIndex((m) => m.role === 'user');
  return firstUser === -1 ? [] : history.slice(firstUser);
}

async function runClaudeLoop(opts: AgentChatOptions): Promise<string> {
  const { system, message, tools = [], executeTool, maxTokens, maxRounds = 5 } = opts;

  const claudeTools: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  }));

  const messages: Anthropic.MessageParam[] = [
    ...sanitizeHistory(opts.history).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ];

  let reply = '';

  for (let round = 0; round < maxRounds; round++) {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
      ...(claudeTools.length > 0 ? { tools: claudeTools } : {}),
    });

    messages.push({ role: 'assistant', content: response.content });

    reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (toolUses.length === 0 || !executeTool) break;

    const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (u) => ({
        type: 'tool_result' as const,
        tool_use_id: u.id,
        content: await executeTool(u.name, u.input ?? {}).catch(
          (err) => `Tool error: ${err?.message ?? 'unknown'}`,
        ),
      })),
    );

    messages.push({ role: 'user', content: results });
  }

  return reply;
}

async function runOpenAILoop(opts: AgentChatOptions): Promise<string> {
  const { system, message, tools = [], executeTool, maxTokens, maxRounds = 5 } = opts;

  const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...sanitizeHistory(opts.history).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  let reply = '';

  for (let round = 0; round < maxRounds; round++) {
    const response = await openai.chat.completions.create({
      model: OPENAI_FALLBACK_MODEL,
      // GPT-5 is a reasoning model: it takes max_completion_tokens, not max_tokens
      max_completion_tokens: maxTokens,
      ...(openaiTools.length > 0 ? { tools: openaiTools } : {}),
      messages,
    });

    const assistantMessage = response.choices[0].message;
    messages.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls ?? [];
    if (toolCalls.length === 0 || !executeTool) {
      reply = assistantMessage.content?.trim() ?? '';
      break;
    }

    const results = await Promise.all(
      toolCalls.map(async (t) => ({
        role: 'tool' as const,
        tool_call_id: t.id,
        content: await executeTool(t.function.name, JSON.parse(t.function.arguments || '{}')).catch(
          (err) => `Tool error: ${err?.message ?? 'unknown'}`,
        ),
      })),
    );

    messages.push(...results);
  }

  return reply;
}
