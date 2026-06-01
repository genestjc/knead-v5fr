/**
 * Knead Agent Runner — runs on Render as a Background Worker
 *
 * Uses SyncAgent from @towns-protocol/sdk (server-side, no React).
 * Listens in NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID for @Demeter mentions
 * from Admin/Contributor wallets, runs the Claude agent loop, and posts results
 * back to Towns.
 *
 * Run with:  npx tsx server/agent-runner.ts
 *
 * Env vars needed on Render:
 *   AGENT_RUNNER_PRIVATE_KEY                        ← new agent wallet private key
 *   NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID                 ✅ already on Render
 *   NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID       ✅ already on Render
 *   NEXT_PUBLIC_BASE_RPC_URL                        ✅ already on Render
 *   ANTHROPIC_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   THIRDWEB_SECRET_KEY
 *   NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS
 *   SHOPIFY_STORE_DOMAIN
 *   SHOPIFY_STOREFRONT_ACCESS_TOKEN
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
import { getSupabaseAdmin } from '@/lib/supabase/server';

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

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Missing ANTHROPIC_API_KEY');
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

  startProposalPoller(channel);

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

  if (!result.success) {
    await channel.sendMessage(`[Demeter] Failed: ${result.summary}`).catch(() => {});
  }
}

function startProposalPoller(channel: Channel) {
  const POLL_INTERVAL = 5 * 60 * 1000;

  async function checkProposals() {
    try {
      const supabase = getSupabaseAdmin();
      const { data: proposals } = await supabase
        .from('proposals')
        .select('id, title, description, items, created_by, vote_threshold, vote_count')
        .eq('status', 'open');

      const ready = (proposals ?? []).filter(
        (p: any) => p.vote_count >= p.vote_threshold,
      );

      for (const proposal of ready) {
        const { data: claimed } = await supabase
          .from('proposals')
          .update({ status: 'triggered', triggered_at: new Date().toISOString() })
          .eq('id', proposal.id)
          .eq('status', 'open')
          .select('id')
          .single();

        if (!claimed) continue;

        console.log(`[proposals] Executing proposal: ${proposal.title}`);
        await channel.sendMessage(`[Demeter] Executing approved proposal: "${proposal.title}"`).catch(() => {});

        const items = (proposal.items as any[]).map((item: any, i: number) => {
          if (item.type === 'usdc')     return `${i + 1}. Pay ${item.amount_usdc} USDC to ${item.recipient_address}${item.notes ? ` for: ${item.notes}` : ''}`;
          if (item.type === 'merch')    return `${i + 1}. Send merch (${item.product_handle ?? 'knead-merch'}) to ${item.recipient_name ?? item.recipient_address}${item.shipping_address ? ` — ship to ${JSON.stringify(item.shipping_address)}` : ''}`;
          if (item.type === 'magazine') return `${i + 1}. Send magazine to ${item.recipient_name ?? item.recipient_address}${item.shipping_address ? ` — ship to ${JSON.stringify(item.shipping_address)}` : ''}`;
          return `${i + 1}. ${JSON.stringify(item)}`;
        });

        const command = `Execute approved proposal: "${proposal.title}".\nItems:\n${items.join('\n')}\nPost a summary when done.`;

        const result = await runAgent(
          { command, senderAddress: proposal.created_by || '', proposalId: proposal.id },
          async (msg: string) => { await channel.sendMessage(`[Demeter] ${msg}`).catch(() => {}); },
        ).catch((err: Error) => ({ success: false, summary: err.message, actionsCompleted: [], errors: [err.message] }));

        await supabase.from('proposals').update({
          status: result.success ? 'executed' : 'failed',
          executed_at: new Date().toISOString(),
          execution_result: result,
        }).eq('id', proposal.id);
      }
    } catch (err: any) {
      console.error('[proposals] Poll error:', err.message);
    }
  }

  setTimeout(checkProposals, 10_000);
  setInterval(checkProposals, POLL_INTERVAL);
  console.log('📋 Proposal poller started (every 5 minutes)');
}

main().catch(err => {
  console.error('❌ FATAL:', (err as Error).message);
  process.exit(1);
});
