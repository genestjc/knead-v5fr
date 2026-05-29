import { TOWNS_CONFIG } from '@/lib/towns-config';
import { getWalletAgentRole } from '@/lib/agent/role-gate';
import { runAgent } from '@/lib/agent';

let _bot: TownsBot | null = null;
let _initPromise: Promise<void> | null = null;

interface TownsMessageEvent {
  senderId: string;
  content: string;
  channelId: string;
  spaceId: string;
  messageId?: string;
}

interface TownsBot {
  sendMessage(channelId: string, text: string): Promise<void>;
  onMessage(handler: (event: TownsMessageEvent) => void): void;
  disconnect(): Promise<void>;
}

export async function initAgentListener(): Promise<void> {
  if (_bot) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const { makeBot } = await import('@towns-protocol/bot');
    const privateKey = process.env.KEY_SHARER_PRIVATE_KEY;
    const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
    const channelId = process.env.NEXT_PUBLIC_CHANNEL_ID;

    if (!privateKey || !spaceId || !channelId) {
      throw new Error('Missing bot env vars: KEY_SHARER_PRIVATE_KEY, NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID, NEXT_PUBLIC_CHANNEL_ID');
    }

    const bot: TownsBot = await makeBot({ privateKey, config: TOWNS_CONFIG });
    bot.onMessage(handleMessage);
    _bot = bot;
    console.log('[agent-listener] Bot connected to Towns space:', spaceId);
  })();

  return _initPromise;
}

export async function stopAgentListener(): Promise<void> {
  if (_bot) {
    await _bot.disconnect();
    _bot = null;
    _initPromise = null;
  }
}

export function isListenerRunning(): boolean {
  return _bot !== null;
}

async function handleMessage(event: TownsMessageEvent): Promise<void> {
  const channelId = process.env.NEXT_PUBLIC_CHANNEL_ID;
  if (event.channelId !== channelId) return;
  if (!/^@agentcommune\b/i.test(event.content.trim())) return;

  const { allowed } = await getWalletAgentRole(event.senderId);
  if (!allowed) return;

  if (_bot) await _bot.sendMessage(event.channelId, `[AgentCommune] Processing: "${event.content.substring(0, 80)}"`).catch(() => {});

  await runAgent({ command: event.content, senderAddress: event.senderId, channelId: event.channelId }, postToTownsChannel)
    .catch(err => ({ success: false, summary: `Agent error: ${err instanceof Error ? err.message : String(err)}`, actionsCompleted: [], errors: [String(err)] }));
}

export async function postToTownsChannel(message: string, channelId?: string): Promise<void> {
  const targetChannel = channelId || process.env.NEXT_PUBLIC_CHANNEL_ID;
  if (_bot && targetChannel) {
    try { await _bot.sendMessage(targetChannel, `[AgentCommune] ${message}`); }
    catch (err) { console.error('[agent-listener] Failed to post:', err); }
    return;
  }
  console.log(`[agent/towns-message] [${targetChannel}] ${message}`);
}
