/**
 * Knead Agent Runner — runs on Render as a Background Worker
 *
 * Uses SyncAgent from @towns-protocol/sdk (server-side, no React).
 * Listens in NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID for @Demeter mentions
 * from Admin/Contributor wallets, answers the question via lib/agent.ts, and
 * posts the reply back to Towns.
 *
 * Demeter is read-only — stories, events, and web search. It cannot spend,
 * order, or mutate anything. See DECISIONS.md (2026-08-09) before adding a
 * tool that writes.
 *
 * Run with:  npx tsx server/agent-runner.ts
 *
 * Env vars needed on Render:
 *   AGENT_RUNNER_PRIVATE_KEY                        ← agent wallet private key
 *   NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID                 ✅ already on Render
 *   NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID       ✅ already on Render
 *   NEXT_PUBLIC_BASE_RPC_URL                        ✅ already on Render
 *   ANTHROPIC_API_KEY                               ← NEW: Claude is primary
 *   OPENAI_API_KEY                                  ← fallback provider
 *   TAVILY_API_KEY                                  ← NEW: web_search tool
 *   NEXT_PUBLIC_SANITY_PROJECT_ID                   ← NEW: article lookups
 *   NEXT_PUBLIC_SANITY_DATASET                      ← NEW: article lookups
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   THIRDWEB_SECRET_KEY
 *   NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS
 *
 * No longer needed (removed with agentic commerce):
 *   SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_ACCESS_TOKEN, AGENTCARD_*
 */

import 'fake-indexeddb/auto'; // polyfill IndexedDB for Node.js (SyncAgent crypto store)
import { ethers } from 'ethers';
import {
  SyncAgent,
  makeSignerContext,
  townsEnv,
  RiverTimelineEvent,
} from '@towns-protocol/sdk';
import type { Channel } from '@towns-protocol/sdk';
import { runAgent } from '@/lib/agent';
import { getWalletAgentRole } from '@/lib/agent/role-gate';

// The Towns SDK catches this error internally and logs it via its debug logger — it recovers
// on its own retry. Filter it from both stdout and stderr so Render stops alerting on it.
function suppressTownsInitError(write: Function) {
  return (chunk: any, ...args: any[]) => {
    const s = typeof chunk === 'string' ? chunk : chunk?.toString?.() ?? '';
    if (s.includes('createMethodSerializationLookup') || s.includes("reading 'I'")) return true;
    return write(chunk, ...args);
  };
}
(process.stdout as any).write = suppressTownsInitError(process.stdout.write.bind(process.stdout));
(process.stderr as any).write = suppressTownsInitError(process.stderr.write.bind(process.stderr));

const SPACE_ID   = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
const CHANNEL_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID!;
const KEY        = process.env.AGENT_RUNNER_PRIVATE_KEY!;
const BASE_RPC   = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

const MENTION_PATTERN = /^@demeter\b/i;

function isBotMentioned(text: string): boolean {
  return MENTION_PATTERN.test(text.trim());
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 Knead Agent Runner');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!SPACE_ID || !CHANNEL_ID || !KEY) {
    throw new Error(
      'Missing env vars: AGENT_RUNNER_PRIVATE_KEY, NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID, NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID',
    );
  }

  // Claude is primary and OpenAI is the fallback, so a missing ANTHROPIC key
  // isn't fatal — it just means every turn pays the fallback path. Warn loudly
  // rather than refusing to boot. Missing BOTH is fatal.
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error('Missing both ANTHROPIC_API_KEY and OPENAI_API_KEY — no provider available');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY missing — every turn will run on the OpenAI fallback');
  }
  if (!process.env.TAVILY_API_KEY) {
    console.warn('⚠️  TAVILY_API_KEY missing — the web_search tool will return "Search unavailable"');
  }

  const townsConfig  = townsEnv().makeTownsConfig('omega', { rpcUrl: BASE_RPC });
  const provider     = new ethers.providers.JsonRpcProvider(BASE_RPC);
  const wallet       = new ethers.Wallet(KEY, provider);
  const delegateWallet = ethers.Wallet.createRandom();

  console.log(`📋 Agent wallet: ${wallet.address}`);
  console.log(`📡 Listening in channel: ${CHANNEL_ID}\n`);

  const signerContext = await makeSignerContext(wallet, delegateWallet);

  const agent = new SyncAgent({
    context: signerContext,
    townsConfig,
    disablePersistenceStore: true,
  });

  await agent.start();

  const botUserId = agent.userId;
  const space     = agent.spaces.getSpace(SPACE_ID);
  const channel   = space.getChannel(CHANNEL_ID);

  // historyEventIds: events that existed at startup — never process these
  // processedEventIds: new events we've already handled — don't double-process
  // Encrypted events are intentionally NOT added until decrypted (kind flips to ChannelMessage)
  const historyEventIds  = new Set<string>();
  const processedEventIds = new Set<string>();
  let firstFire = true;

  channel.timeline.events.subscribe((events) => {
    if (firstFire) {
      events.forEach(e => historyEventIds.add(e.eventId));
      firstFire = false;
      console.log(`[agent] Seeded ${historyEventIds.size} existing events — now listening for new messages`);
      return;
    }

    for (const event of events) {
      if (historyEventIds.has(event.eventId)) continue;   // pre-existing history
      if (processedEventIds.has(event.eventId)) continue; // already handled
      if (event.sender.id === botUserId) { processedEventIds.add(event.eventId); continue; }

      // Skip until decrypted — Observable will fire again once kind flips to ChannelMessage
      if (event.content?.kind !== RiverTimelineEvent.ChannelMessage) continue;

      processedEventIds.add(event.eventId); // mark handled before async work

      const text     = event.content.body;
      const mentions = event.content.mentions ?? [];
      const isMentionedInBody = isBotMentioned(text);
      const isMentionedByRef  = mentions.some((m: any) => m.userId === botUserId);

      console.log(`[agent] New message from ${event.sender.id}: body="${text}" mentions=${JSON.stringify(mentions)}`);

      if (!isMentionedInBody && !isMentionedByRef) continue;

      handleMessage(event.sender.id, text, channel).catch(err => {
        console.error('[agent] Unhandled error:', (err as Error).message);
      });
    }
  });

  console.log('🟢 Agent Runner is online\n');

  process.on('SIGTERM', async () => { await agent.stop(); process.exit(0); });
  process.on('SIGINT',  async () => { await agent.stop(); process.exit(0); });

  setInterval(() => console.log('💓 Online:', new Date().toISOString()), 30 * 60 * 1000);
}

async function handleMessage(senderId: string, content: string, channel: Channel) {
  console.log(`\n[agent] Mention from ${senderId}: ${content}`);

  const { allowed, role } = await getWalletAgentRole(senderId).catch(() => ({ allowed: false, role: null }));
  if (!allowed) {
    console.log(`[agent] Unauthorized mention from ${senderId}`);
    await channel.sendMessage('[Demeter] This bot is only available to Contributors and Admins.').catch(() => {});
    return;
  }

  console.log(`[agent] Role: ${role} — running agent`);
  await channel.sendMessage(`[Demeter] Got it — processing: "${content.substring(0, 80)}"`).catch(() => {});

  const result = await runAgent(
    { command: content, senderAddress: senderId, channelId: CHANNEL_ID },
    async (message: string) => {
      await channel.sendMessage(`[Demeter] ${message}`).catch(() => {});
    },
  ).catch((err: Error) => ({
    success: false,
    summary: `Agent error: ${err.message}`,
    actionsCompleted: [] as string[],
    errors: [err.message],
  }));

  console.log(`[agent] Done. Success: ${result.success} — ${result.summary}`);

  // Always post the final response back to chat
  const reply = result.success ? result.summary : `Failed: ${result.summary}`;
  if (reply && reply !== 'Agent completed.') {
    await channel.sendMessage(`[Demeter] ${reply}`).catch(() => {});
  }
}

main().catch(err => {
  console.error('❌ FATAL:', (err as Error).message);
  process.exit(1);
});
