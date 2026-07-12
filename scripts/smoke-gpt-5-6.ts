import 'dotenv/config';
import OpenAI from 'openai';

/**
 * Live smoke test for the GPT-5.6 migration (lib/ai/router.ts + lib/agent.ts).
 *
 * Typechecking proved the code compiles against the v6 SDK; this proves the
 * tool loops actually complete against the live API. Three checks:
 *
 *   1. Luna — the router's chat loop shape: function tool + reasoning_effort
 *      'none' → tool result → final text. (lib/ai/router.ts runOpenAILoop)
 *   2. Terra — the payments agent's shape: the Responses API's stateless
 *      tool loop (store: false, encrypted reasoning replayed, tool results
 *      linked by call_id) against the real payment tool schemas with MOCKED
 *      results. Nothing is purchased, no USDC moves, no cards are issued.
 *      (lib/agent.ts runAgent — Responses, not Chat Completions, because
 *      Chat Completions rejects tools at any effective reasoning effort
 *      other than 'none' on the 5.6 family.)
 *   3. Constraint probe — confirms Chat Completions still rejects function
 *      tools combined with reasoning_effort 'low' on the 5.6 family, which
 *      is why the router uses 'none' and the payments agent uses the
 *      Responses API (confirmed live: the Towns agent hit this exact 400 on
 *      gpt-5.6-terra even with the field UNSET — the default effort counts).
 *      If this ever starts succeeding, the constraint was lifted and the
 *      router could go back to 'low'.
 *
 * Usage: npx tsx scripts/smoke-gpt-5-6.ts
 * Requires OPENAI_API_KEY. Costs a fraction of a cent.
 */

// Keep in sync with the tier constants in lib/ai/router.ts and MODEL in
// lib/agent.ts. Not imported from there because the router module constructs
// an Anthropic client at import time, which needs ANTHROPIC_API_KEY.
// Sol (the Opus-surface fallback tier) shares the family API shape with
// these two; the Luna check covers the tool-loop mechanics for all tiers.
const LUNA = 'gpt-5.6-luna';
const TERRA = 'gpt-5.6-terra';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let failures = 0;

function pass(name: string, detail: string) {
  console.log(`  PASS  ${name} — ${detail}`);
}

function fail(name: string, detail: string) {
  failures++;
  console.error(`  FAIL  ${name} — ${detail}`);
}

function functionCalls(message: OpenAI.Chat.Completions.ChatCompletionMessage) {
  return (message.tool_calls ?? []).filter(
    (t): t is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall =>
      t.type === 'function',
  );
}

// ── 1. Luna: router-style tool loop ─────────────────────────────────────────

async function checkLunaToolLoop() {
  const name = 'Luna tool loop';
  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'get_source_file',
        description: 'Fetch a source file from the Knead repository by path.',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Repo-relative file path.' } },
          required: ['path'],
        },
      },
    },
  ];

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        'You are a build assistant. Answer questions about the repo. ' +
        'Always fetch the file before describing it.',
    },
    { role: 'user', content: 'What does package.json name this project? Check the file.' },
  ];

  // Same params as runOpenAILoop in lib/ai/router.ts
  const first = await openai.chat.completions.create({
    model: LUNA,
    max_completion_tokens: 4096,
    reasoning_effort: 'none',
    tools,
    messages,
  });

  const calls = functionCalls(first.choices[0].message);
  if (calls.length === 0) {
    return fail(name, `expected a tool call, got none (finish=${first.choices[0].finish_reason})`);
  }

  messages.push(first.choices[0].message);
  for (const call of calls) {
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: JSON.stringify({ path: 'package.json', content: '{ "name": "knead-magazine" }' }),
    });
  }

  const second = await openai.chat.completions.create({
    model: LUNA,
    max_completion_tokens: 4096,
    reasoning_effort: 'none',
    tools,
    messages,
  });

  const text = second.choices[0].message.content?.trim() ?? '';
  if (!text.toLowerCase().includes('knead-magazine')) {
    return fail(name, `final reply didn't use the tool result: ${JSON.stringify(text.slice(0, 200))}`);
  }
  pass(name, `tool call → result → grounded reply (${text.length} chars)`);
}

// ── 2. Terra: payments-agent tool selection (mocked, no side effects) ───────

async function checkTerraToolSelection() {
  const name = 'Terra payment tool loop (Responses API)';
  // Trimmed copies of the schemas in lib/agent.ts — enough for the model to
  // choose between a direct USDC transfer and the card/checkout path.
  const tools: OpenAI.Responses.Tool[] = [
    {
      type: 'function',
      strict: false,
      name: 'request_virtual_card',
      description: 'Request a one-time virtual card for a USD amount. Use before any Shopify checkout.',
      parameters: {
        type: 'object',
        properties: { amount_usd: { type: 'number' }, purpose: { type: 'string' } },
        required: ['amount_usd', 'purpose'],
      },
    },
    {
      type: 'function',
      strict: false,
      name: 'send_usdc_payment',
      description:
        'Send USDC directly to a contributor wallet on Base L2 for labor payments. ' +
        'Do NOT use for merch or magazine purchases.',
      parameters: {
        type: 'object',
        properties: {
          to_address: { type: 'string' },
          amount_usdc: { type: 'number' },
          memo: { type: 'string' },
        },
        required: ['to_address', 'amount_usdc', 'memo'],
      },
    },
    {
      type: 'function',
      strict: false,
      name: 'lookup_member',
      description: 'Look up a Knead member by wallet address or alias.',
      parameters: {
        type: 'object',
        properties: { identifier: { type: 'string' } },
        required: ['identifier'],
      },
    },
  ];

  const instructions =
    'You are Demeter, the payments agent. For labor payments use send_usdc_payment ' +
    'directly — never a virtual card. Look up members you do not have an address for.';

  const mockResults: Record<string, string> = {
    lookup_member: JSON.stringify({ found: true, address: '0x1111111111111111111111111111111111111111', alias: 'mika' }),
    send_usdc_payment: JSON.stringify({ txHash: '0xmocked', amount: 25 }),
  };

  // Same stateless loop as lib/agent.ts runAgent: store false, reasoning +
  // function_call items replayed each round, results linked via call_id.
  const inputItems: OpenAI.Responses.ResponseInputItem[] = [
    { role: 'user', content: 'Pay contributor "mika" 25 USDC for copy editing this issue.' },
  ];

  const toolsUsed: string[] = [];
  for (let round = 0; round < 5; round++) {
    const response = await openai.responses.create({
      model: TERRA,
      max_output_tokens: 8192,
      instructions,
      tools,
      input: inputItems,
      store: false,
      include: ['reasoning.encrypted_content'],
    });

    const replayable = response.output.filter(
      (
        item,
      ): item is
        | OpenAI.Responses.ResponseOutputMessage
        | OpenAI.Responses.ResponseReasoningItem
        | OpenAI.Responses.ResponseFunctionToolCall =>
        item.type === 'message' || item.type === 'reasoning' || item.type === 'function_call',
    );
    inputItems.push(...replayable);

    const calls = response.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === 'function_call',
    );
    if (calls.length === 0) break;

    for (const call of calls) {
      toolsUsed.push(call.name);
      if (!(call.name in mockResults)) {
        return fail(name, `picked the wrong tool for a labor payment: ${call.name}`);
      }
      inputItems.push({
        type: 'function_call_output',
        call_id: call.call_id,
        output: mockResults[call.name],
      });
    }
  }

  if (!toolsUsed.includes('send_usdc_payment')) {
    return fail(name, `never selected send_usdc_payment (used: ${toolsUsed.join(', ') || 'none'})`);
  }
  pass(name, `tool sequence: ${toolsUsed.join(' → ')}`);
}

// ── 3. Constraint probe: tools + reasoning_effort 'low' should be rejected ──

async function checkEffortConstraint() {
  const name = "constraint probe (tools + effort 'low')";
  try {
    await openai.chat.completions.create({
      model: LUNA,
      max_completion_tokens: 256,
      reasoning_effort: 'low',
      tools: [
        {
          type: 'function',
          function: { name: 'noop', description: 'No-op.', parameters: { type: 'object', properties: {} } },
        },
      ],
      messages: [{ role: 'user', content: 'Say hi.' }],
    });
    pass(
      name,
      "call SUCCEEDED — OpenAI lifted the restriction; the router's reasoning_effort could return to 'low'",
    );
  } catch (err: any) {
    const msg = String(err?.message ?? '');
    // Assert the SPECIFIC rejection, not just any 400 — a malformed request
    // or model-config problem is also a 400 and must not count as proof.
    if (err?.status === 400 && /reasoning[_\s]?effort/i.test(msg) && /not supported/i.test(msg)) {
      pass(name, `rejected with the expected constraint error (${msg.slice(0, 120)})`);
    } else if (err?.status === 400) {
      fail(name, `400, but NOT the reasoning_effort constraint — investigate: ${msg.slice(0, 200)}`);
    } else {
      fail(name, `unexpected error (${err?.status}): ${msg.slice(0, 200)}`);
    }
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set (put it in .env or the shell environment).');
    process.exit(1);
  }
  console.log(`Smoke-testing ${LUNA} and ${TERRA} against the live API…\n`);
  await checkLunaToolLoop();
  await checkTerraToolSelection();
  await checkEffortConstraint();
  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
