/**
 * Towns Protocol Agent Listener
 *
 * Connects to the Knead Towns Space as a bot, listens for messages in the
 * configured agent channel, role-gates each sender, then routes eligible
 * commands to the Claude agent.
 *
 * Also exports postToTownsChannel() which the agent itself calls to report back.
 *
 * Env vars required:
 *   KEY_SHARER_PRIVATE_KEY     — reuse the same private key already on Render
 *   NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID   — Towns space to join
 *   NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID     — the channel the bot listens in and posts to (already set on Vercel)
 *
 * The @towns-protocol/bot package provides makeBot().
 * Adjust method names below if the installed version differs from this API.
 */

import { TOWNS_CONFIG } from '@/lib/towns-config';
import { getWalletAgentRole } from '@/lib/agent/role-gate';
import { runAgent } from '@/lib/agent';

// ─── Command patterns ─────────────────────────────────────────────────────────
// Messages that match these patterns are forwarded to the agent.
// Anything else is silently ignored.
const COMMAND_PATTERNS: RegExp[] = [
  /send\s+merch\s+to\s+(0x[a-fA-F0-9]+|\S+)/i,
  /send\s+magazine\s+to\s+(0x[a-fA-F0-9]+|\S+)/i,
  /pay\s+(0x[a-fA-F0-9]+|\S+)\s+(\d+(?:\.\d+)?)\s*(?:usdc)?/i,
  /execute\s+proposal\s+([a-f0-9-]+)/i,
  /^@knead[-_]?agent\b/i,   // direct mention
];

function isAgentCommand(text: string): boolean {
  return COMMAND_PATTERNS.some(p => p.test(text));
}

// ─── Module-level bot singleton ───────────────────────────────────────────────

let _bot: TownsBot | null = null;
let _initPromise: Promise<void> | null = null;

interface TownsMessageEvent {
  senderId: string;         // wallet address
  content: string;
  channelId: string;
  spaceId: string;
  messageId?: string;
}

// Minimal interface for what we need from @towns-protocol/bot
interface TownsBot {
  sendMessage(channelId: string, text: string): Promise<void>;
  onMessage(handler: (event: TownsMessageEvent) => void): void;
  disconnect(): Promise<void>;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initAgentListener(): Promise<void> {
  if (_bot) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const { makeBot } = await import('@towns-protocol/bot');
    const privateKey = process.env.KEY_SHARER_PRIVATE_KEY;
    const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
    const channelId = process.env.NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID;

    if (!privateKey || !spaceId || !channelId) {
      throw new Error(
        'Missing bot env vars: KEY_SHARER_PRIVATE_KEY, ' +
        'NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID, NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID',
      );
    }

    const bot: TownsBot = await makeBot({
      privateKey,
      config: TOWNS_CONFIG,
    });

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
    console.log('[agent-listener] Bot disconnected');
  }
}

export function isListenerRunning(): boolean {
  return _bot !== null;
}

// ─── Message handler ──────────────────────────────────────────────────────────

async function handleMessage(event: TownsMessageEvent): Promise<void> {
  const channelId = process.env.NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID;
  if (event.channelId !== channelId) return;           // wrong channel
  if (!isAgentCommand(event.content)) return;          // not a command

  const { allowed, role } = await getWalletAgentRole(event.senderId);
  if (!allowed) {
    // Silently ignore — don't expose role-gate details in public chat
    return;
  }

  console.log(
    `[agent-listener] Command from ${role} ${event.senderId}: ${event.content}`,
  );

  // Acknowledge receipt in chat
  if (_bot) {
    await _bot.sendMessage(
      event.channelId,
      `[Knead Agent] Got it — processing: "${event.content.substring(0, 80)}"`,
    ).catch(() => {});
  }

  const result = await runAgent(
    {
      command: event.content,
      senderAddress: event.senderId,
      channelId: event.channelId,
    },
    postToTownsChannel,
  ).catch(err => ({
    success: false,
    summary: `Agent error: ${err instanceof Error ? err.message : String(err)}`,
    actionsCompleted: [],
    errors: [String(err)],
  }));

  if (!result.success && _bot) {
    await _bot.sendMessage(
      event.channelId,
      `[Knead Agent] Failed: ${result.summary}`,
    ).catch(() => {});
  }
}

// ─── Post back to Towns chat ──────────────────────────────────────────────────

/**
 * Called by the agent's post_towns_message tool to report status.
 * Works even if the listener bot isn't running — falls back to a no-op log.
 */
export async function postToTownsChannel(
  message: string,
  channelId?: string,
): Promise<void> {
  const targetChannel = channelId || process.env.NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID;

  if (_bot && targetChannel) {
    try {
      await _bot.sendMessage(targetChannel, `[Knead Agent] ${message}`);
    } catch (err) {
      console.error('[agent-listener] Failed to post message:', err);
    }
    return;
  }

  // Listener not running (e.g. API-only context) — log for visibility
  console.log(`[agent/towns-message] [${targetChannel}] ${message}`);
}
