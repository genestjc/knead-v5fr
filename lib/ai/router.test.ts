/**
 * The router's failure modes, where the damage is quiet:
 *
 *  - a turn that ends on tool results nobody read, so the answer is written
 *    from what the model guessed before it fetched anything
 *  - one malformed tool call from a model taking down the whole provider loop
 *    and replaying the turn on the other provider
 *  - a truncated file losing its closing VERBATIM marker, after which the model
 *    cannot tell repo source from its own text
 *  - a caller pairing an expensive Claude tier with a budget OpenAI one by
 *    forgetting an option
 *  - retrieval re-run on the second provider after the first already did it
 *
 * The provider SDKs are real clients with their network call stubbed, so the
 * loops under test are the ones that ship.
 */
process.env.ANTHROPIC_API_KEY ||= 'test-key';
process.env.OPENAI_API_KEY ||= 'test-key';

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLAUDE_OPUS,
  CLAUDE_SONNET,
  MODEL_PROFILES,
  MAX_IMAGE_BYTES,
  MAX_TOTAL_IMAGE_BYTES,
  OPENAI_LUNA,
  OPENAI_SOL,
  OPENAI_TERRA,
  checkImages,
  getAnthropic,
  getOpenAI,
  isDeterministicRequestError,
  modelFor,
  runAgentChat,
  sanitizeHistory,
  truncateToolResult,
  validateToolArgs,
  type AgentTool,
  type ImageInput,
} from './router';

// ---------- stubs ----------

type Call = { params: any; options?: any };

function stubClaude(replies: any[]): Call[] {
  const calls: Call[] = [];
  (getAnthropic().messages as any).create = async (params: any, options?: any) => {
    calls.push({ params, options });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (typeof reply === 'function') return reply();
    return reply;
  };
  return calls;
}

function stubOpenAI(replies: any[]): Call[] {
  const calls: Call[] = [];
  (getOpenAI().chat.completions as any).create = async (params: any, options?: any) => {
    calls.push({ params, options });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (typeof reply === 'function') return reply();
    return reply;
  };
  return calls;
}

const claudeSays = (text: string) => ({
  content: [{ type: 'text', text }],
  stop_reason: 'end_turn',
});

const claudeCallsTool = (name: string, input: unknown, text?: string) => ({
  content: [
    ...(text ? [{ type: 'text', text }] : []),
    { type: 'tool_use', id: `tu_${name}`, name, input },
  ],
  stop_reason: 'tool_use',
});

const openaiSays = (content: string | null) => ({
  choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }],
});

const openaiCallsTool = (name: string, args: string, content: string | null = null) => ({
  choices: [
    {
      finish_reason: 'tool_calls',
      message: {
        role: 'assistant',
        content,
        tool_calls: [{ id: `tc_${name}`, type: 'function', function: { name, arguments: args } }],
      },
    },
  ],
});

const READ_TOOL: AgentTool = {
  name: 'get_source_file',
  description: 'Read a file.',
  parameters: {
    type: 'object',
    properties: { path: { type: 'string' } },
    required: ['path'],
  },
};

const base = {
  system: 'You are a test.',
  message: 'hello',
  maxTokens: 100,
  logTag: 'test',
} as const;

const httpError = (status: number) => Object.assign(new Error(`http ${status}`), { status });

// ---------- model profiles ----------

test('profiles resolve to the intended paired models', () => {
  assert.deepEqual(MODEL_PROFILES.editorial, { claude: CLAUDE_OPUS, openai: OPENAI_SOL });
  assert.deepEqual(MODEL_PROFILES.assistant, { claude: CLAUDE_SONNET, openai: OPENAI_TERRA });
  assert.deepEqual(MODEL_PROFILES['high-volume'], { claude: CLAUDE_SONNET, openai: OPENAI_LUNA });
  assert.equal(modelFor('assistant', 'claude'), CLAUDE_SONNET);
  assert.equal(modelFor('assistant', 'openai'), OPENAI_TERRA);
});

test('a profile sends both providers the tier that belongs to it', async () => {
  const claude = stubClaude([claudeSays('fine')]);
  stubOpenAI([]);
  await runAgentChat({ ...base, profile: 'assistant' });
  assert.equal(claude[0].params.model, CLAUDE_SONNET);

  // The default is a coherent pair too, not Opus-with-a-budget-fallback.
  const claudeFails = stubClaude([
    () => {
      throw httpError(503);
    },
  ]);
  const openai = stubOpenAI([openaiSays('covered')]);
  const reply = await runAgentChat({ ...base });
  assert.equal(reply, 'covered');
  assert.equal(claudeFails[0].params.model, CLAUDE_OPUS);
  assert.equal(openai[0].params.model, OPENAI_SOL);
});

// ---------- failover ----------

test('a provider failure before any tool ran is covered by the other provider', async () => {
  const claude = stubClaude([
    () => {
      throw httpError(500);
    },
  ]);
  const openai = stubOpenAI([openaiSays('the second provider answered')]);

  const reply = await runAgentChat({ ...base, tools: [READ_TOOL], executeTool: async () => 'x' });

  assert.equal(reply, 'the second provider answered');
  assert.equal(claude.length, 1);
  assert.equal(openai.length, 1);
});

test('an empty primary reply falls back', async () => {
  stubClaude([claudeSays('   ')]);
  const openai = stubOpenAI([openaiSays('not empty')]);

  assert.equal(await runAgentChat({ ...base }), 'not empty');
  assert.equal(openai.length, 1);
});

test('a deterministic bad request is not retried on the other provider', async () => {
  stubClaude([
    () => {
      throw httpError(400);
    },
  ]);
  const openai = stubOpenAI([openaiSays('should never be reached')]);

  await assert.rejects(() => runAgentChat({ ...base }), /http 400/);
  assert.equal(openai.length, 0, 'a request we built wrong fails the same way on both providers');
});

test('auth failures DO fail over — one provider being misconfigured is the outage', () => {
  assert.equal(isDeterministicRequestError(httpError(401)), false);
  assert.equal(isDeterministicRequestError(httpError(429)), false);
  assert.equal(isDeterministicRequestError(httpError(500)), false);
  assert.equal(isDeterministicRequestError(httpError(400)), true);
  assert.equal(isDeterministicRequestError(httpError(422)), true);
  assert.equal(isDeterministicRequestError({ error: { type: 'invalid_request_error' } }), true);
});

test('a tool that must not run twice stops the turn instead of replaying it', async () => {
  const writeTool: AgentTool = { ...READ_TOOL, name: 'charge_card', replaySafe: false };
  let executions = 0;
  stubClaude([
    claudeCallsTool('charge_card', { path: 'x' }),
    () => {
      throw httpError(503);
    },
  ]);
  const openai = stubOpenAI([openaiSays('would have replayed the write')]);

  await assert.rejects(
    () =>
      runAgentChat({
        ...base,
        maxRounds: 3,
        tools: [writeTool],
        executeTool: async () => {
          executions++;
          return 'charged';
        },
      }),
    /http 503/,
  );
  assert.equal(executions, 1);
  assert.equal(openai.length, 0);
});

// ---------- final-round synthesis ----------

test('a final round of only tool calls gets a forced synthesis', async () => {
  const claude = stubClaude([
    claudeCallsTool('get_source_file', { path: 'a.ts' }),
    claudeSays('answer built from the file'),
  ]);

  const reply = await runAgentChat({
    ...base,
    maxRounds: 1,
    tools: [READ_TOOL],
    executeTool: async () => 'FILE BODY',
  });

  assert.equal(reply, 'answer built from the file');
  assert.equal(claude.length, 2);
  assert.equal(claude[1].params.tools, undefined, 'the synthesis call must not offer tools');
});

test('a final round of text AND tool calls still gets a forced synthesis', async () => {
  const claude = stubClaude([
    claudeCallsTool('get_source_file', { path: 'a.ts' }, 'Let me check the auth route.'),
    claudeSays('The auth route does X.'),
  ]);

  const reply = await runAgentChat({
    ...base,
    maxRounds: 1,
    tools: [READ_TOOL],
    executeTool: async () => 'FILE BODY',
  });

  assert.equal(claude.length, 2, 'preliminary text must not stand in for reading the result');
  assert.equal(reply, 'The auth route does X.');
  assert.ok(!reply.includes('Let me check'), 'progress notes are not the answer');
});

test('the same holds on the OpenAI loop', async () => {
  stubClaude([]);
  const openai = stubOpenAI([
    openaiCallsTool('get_source_file', '{"path":"a.ts"}', 'One moment.'),
    openaiSays('The file defines X.'),
  ]);

  const reply = await runAgentChat({
    ...base,
    preferredProvider: 'openai',
    maxRounds: 1,
    tools: [READ_TOOL],
    executeTool: async () => 'FILE BODY',
  });

  assert.equal(openai.length, 2);
  assert.equal(reply, 'The file defines X.');
});

test('a model that stops on its own keeps the prose it wrote along the way', async () => {
  stubClaude([
    claudeCallsTool('get_source_file', { path: 'a.ts' }, 'Good question —'),
    claudeSays('here is what it does.'),
  ]);

  const reply = await runAgentChat({
    ...base,
    maxRounds: 3,
    tools: [READ_TOOL],
    executeTool: async () => 'FILE BODY',
  });

  assert.equal(reply, 'Good question —\n\nhere is what it does.');
});

// ---------- tool arguments ----------

test('malformed OpenAI tool JSON comes back as a tool error, not a failover', async () => {
  const claude = stubClaude([claudeSays('should never be reached')]);
  const openai = stubOpenAI([
    openaiCallsTool('get_source_file', '{"path": "a.ts'),
    openaiSays('I could not read that file.'),
  ]);
  let executions = 0;

  const reply = await runAgentChat({
    ...base,
    preferredProvider: 'openai',
    maxRounds: 3,
    tools: [READ_TOOL],
    executeTool: async () => {
      executions++;
      return 'FILE BODY';
    },
  });

  assert.equal(reply, 'I could not read that file.');
  assert.equal(executions, 0, 'a call we cannot parse must not reach the executor');
  assert.equal(claude.length, 0, 'one bad tool call is not a provider outage');

  const toolMessage = openai[1].params.messages.find((m: any) => m.role === 'tool');
  assert.match(toolMessage.content, /Tool error/);
  assert.match(toolMessage.content, /not valid JSON/);
});

test('arguments are shape-checked against the declared schema', () => {
  const tool: AgentTool = {
    name: 't',
    description: '',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        lines: { type: 'integer' },
        level: { type: 'string', enum: ['low', 'high'] },
      },
      required: ['path'],
    },
  };
  assert.equal(validateToolArgs(tool, { path: 'a.ts' }), null);
  assert.match(validateToolArgs(tool, {}) ?? '', /missing required argument: path/);
  assert.match(validateToolArgs(tool, 'a.ts') ?? '', /must be a JSON object/);
  assert.match(validateToolArgs(tool, { path: 3 }) ?? '', /"path" must be string/);
  assert.match(validateToolArgs(tool, { path: 'a', lines: 1.5 }) ?? '', /must be an integer/);
  assert.match(validateToolArgs(tool, { path: 'a', level: 'mid' }) ?? '', /must be one of: low, high/);
});

test('an executor that throws returns a tool error the model can act on, not the raw message', async () => {
  const openai = stubOpenAI([
    openaiCallsTool('get_source_file', '{"path":"a.ts"}'),
    openaiSays('done'),
  ]);

  await runAgentChat({
    ...base,
    preferredProvider: 'openai',
    maxRounds: 3,
    tools: [READ_TOOL],
    executeTool: async () => {
      throw new Error('postgres://user:hunter2@db.internal/knead relation "profiles" missing');
    },
  });

  const toolMessage = openai[1].params.messages.find((m: any) => m.role === 'tool');
  assert.match(toolMessage.content, /Tool error/);
  assert.ok(!toolMessage.content.includes('hunter2'), 'internal detail stays in the server log');
  assert.ok(!toolMessage.content.includes('db.internal'));
});

// ---------- parallelism ----------

test('independent reads in one round run in parallel', async () => {
  stubClaude([
    {
      content: [
        { type: 'tool_use', id: 'a', name: 'get_source_file', input: { path: 'a.ts' } },
        { type: 'tool_use', id: 'b', name: 'get_source_file', input: { path: 'b.ts' } },
      ],
      stop_reason: 'tool_use',
    },
    claudeSays('read both'),
  ]);

  let inFlight = 0;
  let peak = 0;
  await runAgentChat({
    ...base,
    maxRounds: 2,
    tools: [READ_TOOL],
    executeTool: async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return 'BODY';
    },
  });

  assert.equal(peak, 2, 'two source lookups should not be serialised');
});

test('a batch holding a non-parallel-safe tool runs in order', async () => {
  const ordered: AgentTool = { ...READ_TOOL, name: 'apply_edit', parallelSafe: false };
  stubClaude([
    {
      content: [
        { type: 'tool_use', id: 'a', name: 'apply_edit', input: { path: 'a.ts' } },
        { type: 'tool_use', id: 'b', name: 'get_source_file', input: { path: 'b.ts' } },
      ],
      stop_reason: 'tool_use',
    },
    claudeSays('done'),
  ]);

  let inFlight = 0;
  let peak = 0;
  const order: string[] = [];
  await runAgentChat({
    ...base,
    maxRounds: 2,
    tools: [ordered, READ_TOOL],
    executeTool: async (name) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      order.push(name);
      inFlight--;
      return 'BODY';
    },
  });

  assert.equal(peak, 1);
  assert.deepEqual(order, ['apply_edit', 'get_source_file']);
});

// ---------- truncation ----------

test('an oversized tool result keeps both ends, so the closing marker survives', () => {
  const open = '===== BEGIN VERBATIM SOURCE =====';
  const close = '===== END VERBATIM SOURCE =====';
  const body = 'x'.repeat(50_000);
  const out = truncateToolResult([open, body, close].join('\n'), 2_000);

  assert.ok(out.length <= 2_000);
  assert.ok(out.startsWith(open), 'the opening marker is kept');
  assert.ok(out.endsWith(close), 'the closing marker is kept — the model needs the boundary');
  assert.match(out, /\[Truncated — [\d,]+ characters were removed from the middle/);
});

test('a result inside the cap is returned untouched', () => {
  assert.equal(truncateToolResult('short', 2_000), 'short');
});

test('a huge tool result is truncated before it reaches the model', async () => {
  const openai = stubOpenAI([
    openaiCallsTool('get_source_file', '{"path":"a.ts"}'),
    openaiSays('done'),
  ]);

  await runAgentChat({
    ...base,
    preferredProvider: 'openai',
    maxRounds: 3,
    tools: [READ_TOOL],
    executeTool: async () => 'y'.repeat(500_000),
  });

  const toolMessage = openai[1].params.messages.find((m: any) => m.role === 'tool');
  assert.ok(toolMessage.content.length <= 16_000);
  assert.match(toolMessage.content, /Truncated/);
});

// ---------- images ----------

const imageOf = (bytes: number): ImageInput => ({
  // 4 base64 chars per 3 bytes, no padding.
  data: 'A'.repeat(Math.ceil((bytes * 4) / 3)),
  mediaType: 'image/png',
});

test('an oversized image is rejected at the router boundary, not at the provider', async () => {
  const claude = stubClaude([claudeSays('should never be reached')]);
  await assert.rejects(
    () => runAgentChat({ ...base, images: [imageOf(MAX_IMAGE_BYTES + 1_000_000)] }),
    /over the 5MB limit/,
  );
  assert.equal(claude.length, 0);
});

test('images under the caps are sent', async () => {
  const claude = stubClaude([claudeSays('graded')]);
  await runAgentChat({ ...base, images: [imageOf(100_000)] });
  assert.equal(claude.length, 1);
  // Images first, instruction text last — deliberate for judging passes.
  // messages[0] is the current user turn: the loop appends to the same array,
  // so the last entry is the assistant reply by the time we read it.
  const content = claude[0].params.messages[0].content;
  assert.equal(content[0].type, 'image');
  assert.equal(content.at(-1).type, 'text');
});

test('the aggregate image budget is enforced, not just the per-image one', () => {
  const each = imageOf(4_000_000);
  const many = Array.from({ length: 6 }, () => each);
  const problems = checkImages(many);
  assert.equal(problems.length, 1, 'every image is individually legal');
  assert.match(problems[0], /over the 20MB one request can carry/);
  assert.ok(6 * 4_000_000 > MAX_TOTAL_IMAGE_BYTES);
});

test('too many images is still its own problem', () => {
  const problems = checkImages(Array.from({ length: 21 }, () => imageOf(1_000)));
  assert.match(problems[0], /at most 20 can be sent/);
});

// ---------- history ----------

test('history is trimmed to start on a user message', () => {
  const trimmed = sanitizeHistory([
    { role: 'assistant', content: 'Hi! Ask me anything.' },
    { role: 'user', content: 'what is knead' },
    { role: 'assistant', content: 'a magazine' },
  ]);
  assert.equal(trimmed.length, 2);
  assert.equal(trimmed[0].role, 'user');
});

test('history with no user message at all is dropped', () => {
  assert.deepEqual(sanitizeHistory([{ role: 'assistant', content: 'hello' }]), []);
});

test('history is capped by size as well as by message count', () => {
  const long = Array.from({ length: 12 }, (_, i) => ({
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: 'x'.repeat(5_000),
  }));
  const trimmed = sanitizeHistory(long);
  const chars = trimmed.reduce((n, m) => n + m.content.length, 0);
  assert.ok(chars <= 24_000, `history was ${chars} chars`);
  assert.equal(trimmed[0].role, 'user', 'trimming by size still has to land on a user turn');
});

test('a single oversized message is kept rather than emptying the history', () => {
  const trimmed = sanitizeHistory([{ role: 'user', content: 'x'.repeat(100_000) }]);
  assert.equal(trimmed.length, 1);
});
