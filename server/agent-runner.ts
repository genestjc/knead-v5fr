import { ethers } from 'ethers';
import { connectTowns, townsEnv } from '@towns-protocol/sdk';
import { runAgent } from '@/lib/agent';
import { getWalletAgentRole } from '@/lib/agent/role-gate';
import { getSupabaseAdmin } from '@/lib/supabase/server';

const SPACE_ID   = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
const CHANNEL_ID = process.env.NEXT_PUBLIC_CHANNEL_ID!;
const KEY        = process.env.AGENT_RUNNER_PRIVATE_KEY!;
const BASE_RPC   = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

const MENTION_PATTERN = /^@agentcommune\b/i;

function isBotMentioned(text: string): boolean {
  return MENTION_PATTERN.test(text.trim());
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 AgentCommune Runner');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!SPACE_ID || !CHANNEL_ID || !KEY) throw new Error('Missing env vars: AGENT_RUNNER_PRIVATE_KEY, NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID, NEXT_PUBLIC_CHANNEL_ID');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');

  const townsConfig = townsEnv().makeTownsConfig('omega', { rpcUrl: BASE_RPC });
  const provider    = new ethers.providers.JsonRpcProvider(BASE_RPC);
  const wallet      = new ethers.Wallet(KEY, provider);

  console.log(`📋 Agent wallet: ${wallet.address}`);
  console.log(`📡 Listening in channel: ${CHANNEL_ID}\n`);

  const agent  = await connectTowns(wallet, { townsConfig });
  const space  = await agent.spaces.getSpace(SPACE_ID);
  const channel = await space.getChannel(CHANNEL_ID);

  // NOTE: verify the exact event name against your @towns-protocol/sdk version
  // Common alternatives: 'event', 'timeline', 'newMessage'
  channel.on('message', async (message: { senderId: string; content: string }) => {
    const { senderId, content } = message;
    if (senderId === wallet.address) return;
    if (!isBotMentioned(content)) return;

    console.log(`\n[agent] Mention from ${senderId}: ${content}`);

    const { allowed, role } = await getWalletAgentRole(senderId).catch(() => ({ allowed: false, role: null }));
    if (!allowed) {
      console.log(`[agent] Unauthorized mention from ${senderId}`);
      await channel.sendMessage(`[AgentCommune] This bot is only available to Contributors and Admins.`).catch(() => {});
      return;
    }

    console.log(`[agent] Role: ${role} — running agent`);
    await channel.sendMessage(`[AgentCommune] Got it — processing: "${content.substring(0, 80)}"`).catch(() => {});

    const result = await runAgent(
      { command: content, senderAddress: senderId, channelId: CHANNEL_ID },
      async (msg: string) => { await channel.sendMessage(`[AgentCommune] ${msg}`).catch(() => {}); },
    ).catch((err: Error) => ({ success: false, summary: `Agent error: ${err.message}`, actionsCompleted: [] as string[], errors: [err.message] }));

    console.log(`[agent] Done. Success: ${result.success} — ${result.summary}`);
    if (!result.success) await channel.sendMessage(`[AgentCommune] Failed: ${result.summary}`).catch(() => {});
  });

  console.log('🟢 AgentCommune is online\n');
  startProposalPoller(channel, wallet.address);

  process.on('SIGTERM', () => { agent.stop(); process.exit(0); });
  process.on('SIGINT',  () => { agent.stop(); process.exit(0); });
  setInterval(() => console.log('💓 Online:', new Date().toISOString()), 30 * 60 * 1000);
}

function startProposalPoller(channel: any, botAddress: string) {
  async function checkProposals() {
    try {
      const supabase = getSupabaseAdmin();
      const { data: proposals } = await supabase
        .from('proposals')
        .select('id, title, description, items, created_by, vote_threshold, vote_count')
        .eq('status', 'open');

      const ready = (proposals ?? []).filter((p: any) => p.vote_count >= p.vote_threshold);

      for (const proposal of ready) {
        const { data: claimed } = await supabase
          .from('proposals')
          .update({ status: 'triggered', triggered_at: new Date().toISOString() })
          .eq('id', proposal.id)
          .eq('status', 'open')
          .select('id')
          .single();

        if (!claimed) continue;

        console.log(`[proposals] Executing: ${proposal.title}`);
        await channel.sendMessage(`[AgentCommune] Executing approved proposal: "${proposal.title}"`).catch(() => {});

        const items = (proposal.items as any[]).map((item: any, i: number) => {
          if (item.type === 'usdc') return `${i + 1}. Pay ${item.amount_usdc} USDC to ${item.recipient_address}${item.notes ? ` for: ${item.notes}` : ''}`;
          if (item.type === 'merch') return `${i + 1}. Send merch (${item.product_handle ?? 'knead-merch'}) to ${item.recipient_name ?? item.recipient_address}${item.shipping_address ? ` — ship to ${JSON.stringify(item.shipping_address)}` : ''}`;
          if (item.type === 'magazine') return `${i + 1}. Send magazine to ${item.recipient_name ?? item.recipient_address}${item.shipping_address ? ` — ship to ${JSON.stringify(item.shipping_address)}` : ''}`;
          return `${i + 1}. ${JSON.stringify(item)}`;
        });

        const command = `Execute approved proposal: "${proposal.title}".\nItems:\n${items.join('\n')}\nPost a summary when done.`;

        const result = await runAgent(
          { command, senderAddress: proposal.created_by || botAddress, proposalId: proposal.id },
          async (msg: string) => { await channel.sendMessage(`[AgentCommune] ${msg}`).catch(() => {}); },
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
  setInterval(checkProposals, 5 * 60 * 1000);
  console.log('📋 Proposal poller started (every 5 minutes)');
}

main().catch(err => { console.error('❌ FATAL:', err.message); process.exit(1); });
