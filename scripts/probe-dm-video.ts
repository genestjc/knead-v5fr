import 'dotenv/config';
import 'fake-indexeddb/auto'; // SyncAgent's crypto store needs IndexedDB in Node
import { ethers } from 'ethers';
import { SyncAgent, makeSignerContext, townsEnv, RiverTimelineEvent } from '@towns-protocol/sdk';
import {
  getEvalWalletPair,
  makeUncredentialedWallet,
  signedPost,
  unauthenticatedPost,
  type EvalWallet,
} from '@/lib/eval/eval-wallets';

/**
 * Drive DM and video calling autonomously with the two credentialed test
 * wallets, and report what actually happened.
 *
 * Two phases, because DM is two different systems wearing one name:
 *
 *   1. Messaging — a real end-to-end-encrypted round trip over Towns. A opens
 *      the DM, sends a nonce, B receives and decrypts it, B replies, A receives
 *      the reply. Both sides are real SyncAgents holding real keys, so this
 *      exercises stream creation, membership, encryption and delivery — the
 *      parts that actually break.
 *
 *   2. Video — the Knead HTTP gates. A opens a Daily room for the pair, then
 *      both wallets take owner tokens for it. Every request is wallet-signed
 *      exactly the way the browser signs, so `verifyMemberRequest` and
 *      `isContributor` run for real.
 *
 * Both phases carry controls. A gate only observed letting credentialed callers
 * through has not been shown to be a gate, so the video phase also sends an
 * uncredentialed wallet (expect 403) and an unauthenticated request (expect
 * 401). A run where those two succeed is a failing run, not a passing one.
 *
 * What this does NOT cover: joining the call and moving media. That needs a
 * real WebRTC client, so a green run here means "both participants were issued
 * broadcaster tokens for a room that exists", not "audio and video flowed".
 *
 * Usage
 *   npx tsx scripts/probe-dm-video.ts --origin https://kneadmag.com
 *   npx tsx scripts/probe-dm-video.ts --origin http://localhost:3000 --skip-dm
 *   npx tsx scripts/probe-dm-video.ts --origin https://kneadmag.com --event-room knead-live-abc
 *
 * Requires PROBATIO_EVAL_WALLET_A_PRIVATE_KEY and PROBATIO_EVAL_WALLET_B_PRIVATE_KEY,
 * provisioned by scripts/provision-eval-wallets.ts. Exits non-zero if any
 * expectation is missed.
 */

interface Args {
  origin: string;
  eventRoom: string | null;
  skipDm: boolean;
  skipVideo: boolean;
  timeoutMs: number;
}

interface StepResult {
  phase: 'dm' | 'video';
  label: string;
  ok: boolean;
  expected: string;
  actual: string;
  ms: number;
  detail?: Record<string, unknown>;
}

const results: StepResult[] = [];

function record(step: StepResult): StepResult {
  results.push(step);
  const mark = step.ok ? '✅' : '❌';
  console.log(`${mark} ${step.label}`);
  console.log(`     expected: ${step.expected}`);
  console.log(`     actual:   ${step.actual}  (${step.ms}ms)`);
  if (step.detail && Object.keys(step.detail).length) {
    console.log(`     detail:   ${JSON.stringify(step.detail)}`);
  }
  return step;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    origin: process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '',
    eventRoom: null,
    skipDm: false,
    skipVideo: false,
    timeoutMs: 90_000,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--origin') args.origin = argv[++i] ?? '';
    else if (arg.startsWith('--origin=')) args.origin = arg.slice('--origin='.length);
    else if (arg === '--event-room') args.eventRoom = argv[++i] ?? null;
    else if (arg.startsWith('--event-room=')) args.eventRoom = arg.slice('--event-room='.length);
    else if (arg === '--skip-dm') args.skipDm = true;
    else if (arg === '--skip-video') args.skipVideo = true;
    else if (arg === '--timeout') args.timeoutMs = Number(argv[++i]) * 1000;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  if (!args.origin) {
    console.error('--origin is required (e.g. --origin https://kneadmag.com)');
    process.exit(1);
  }
  args.origin = args.origin.replace(/\/+$/, '');

  return args;
}

// ─── Phase 1: DM messaging over Towns ────────────────────────────────────────

/**
 * Bring a test wallet online as a Towns client.
 *
 * Same shape as server/agent-runner.ts: a fresh delegate wallet per boot and no
 * persistence store, so nothing is carried between runs and each probe starts
 * from the network's state rather than a local cache.
 */
async function startAgent(wallet: EvalWallet): Promise<SyncAgent> {
  // One argument, unlike server/agent-runner.ts. makeTownsConfig on the pinned
  // SDK (1.0.3) takes only the environment id — the `{ rpcUrl }` the runner
  // passes is silently ignored, and typechecks as an error there today.
  const townsConfig = townsEnv().makeTownsConfig('omega');
  const signer = new ethers.Wallet(wallet.privateKey);
  const delegate = ethers.Wallet.createRandom();
  const context = await makeSignerContext(signer, delegate);

  const agent = new SyncAgent({ context, townsConfig, disablePersistenceStore: true });
  await agent.start();

  console.log(`   ${wallet.label} online as ${agent.userId}`);
  return agent;
}

/** Wait for a decrypted DM message matching `matches`, or throw on timeout. */
async function waitForDmMessage(
  dm: { timeline: { events: any } },
  matches: (body: string) => boolean,
  fromUserId: string,
  timeoutMs: number,
  description: string,
): Promise<{ body: string; eventId: string }> {
  const isMatch = (event: any) =>
    // Encrypted events surface first and only become ChannelMessage once
    // decrypted, so an undecrypted event is "not yet", never "not it".
    event?.content?.kind === RiverTimelineEvent.ChannelMessage &&
    event.sender?.id?.toLowerCase() === fromUserId.toLowerCase() &&
    matches(event.content.body);

  const events: any[] = await dm.timeline.events.when(
    (all: any[]) => all.some(isMatch),
    { timeoutMs, description },
  );

  const found = events.find(isMatch);
  return { body: found.content.body, eventId: found.eventId };
}

async function probeDmMessaging(
  a: EvalWallet,
  b: EvalWallet,
  timeoutMs: number,
): Promise<void> {
  const nonce = `probatio-${Date.now().toString(36)}`;

  console.log('\n💬 Phase 1 — DM messaging (Towns, end-to-end encrypted)\n');

  let agentA: SyncAgent | null = null;
  let agentB: SyncAgent | null = null;

  try {
    const bootStarted = Date.now();
    [agentA, agentB] = await Promise.all([startAgent(a), startAgent(b)]);
    record({
      phase: 'dm',
      label: 'Both test wallets connect to Towns',
      ok: true,
      expected: 'two SyncAgents online',
      actual: 'both online',
      ms: Date.now() - bootStarted,
      detail: { a: agentA.userId, b: agentB.userId },
    });

    // Open the DM. The stream id is derived from the pair, so a DM that already
    // exists from an earlier run is the same stream — createDM failing with
    // "already exists" is a success for our purposes, not an error.
    const openStarted = Date.now();
    let opened = 'created';
    try {
      await agentA.dms.createDM(agentB.userId);
    } catch (err) {
      opened = `reused existing (${err instanceof Error ? err.message.slice(0, 80) : 'unknown'})`;
    }
    const dmA = agentA.dms.getDmWithUserId(agentB.userId);
    const dmB = agentB.dms.getDmWithUserId(agentA.userId);

    record({
      phase: 'dm',
      label: 'A opens a DM channel with B',
      ok: Boolean(dmA.data.id) && dmA.data.id === dmB.data.id,
      expected: 'both sides resolve the same DM stream',
      actual: `${opened} — stream ${dmA.data.id}`,
      ms: Date.now() - openStarted,
    });

    // A → B
    const pingText = `${nonce} ping`;
    const pingStarted = Date.now();
    await dmA.sendMessage(pingText);

    let pingOk = false;
    let pingActual = '';
    try {
      const received = await waitForDmMessage(
        dmB,
        (body) => body.includes(pingText),
        agentA.userId,
        timeoutMs,
        'A→B ping',
      );
      pingOk = true;
      pingActual = `B received and decrypted: "${received.body}"`;
    } catch (err) {
      pingActual = `B never received it: ${err instanceof Error ? err.message : String(err)}`;
    }
    record({
      phase: 'dm',
      label: 'A sends a DM, B receives it decrypted',
      ok: pingOk,
      expected: `B's timeline carries "${pingText}"`,
      actual: pingActual,
      ms: Date.now() - pingStarted,
    });

    // B → A. Sent regardless of the ping result: a one-way failure and a
    // both-ways failure point at different things, and only running the reply
    // when the ping worked would hide that.
    const pongText = `${nonce} pong`;
    const pongStarted = Date.now();
    await dmB.sendMessage(pongText);

    let pongOk = false;
    let pongActual = '';
    try {
      const received = await waitForDmMessage(
        dmA,
        (body) => body.includes(pongText),
        agentB.userId,
        timeoutMs,
        'B→A pong',
      );
      pongOk = true;
      pongActual = `A received and decrypted: "${received.body}"`;
    } catch (err) {
      pongActual = `A never received it: ${err instanceof Error ? err.message : String(err)}`;
    }
    record({
      phase: 'dm',
      label: 'B replies, A receives it decrypted',
      ok: pongOk,
      expected: `A's timeline carries "${pongText}"`,
      actual: pongActual,
      ms: Date.now() - pongStarted,
    });
  } finally {
    await Promise.all([agentA?.stop(), agentB?.stop()].filter(Boolean)).catch(() => {});
  }
}

// ─── Phase 2: DM video gates ─────────────────────────────────────────────────

/** Decode a Daily meeting token's payload for the record. Never throws. */
function decodeDailyToken(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Daily encodes the owner flag as `o` in its meeting tokens. Read it
 * tolerantly: an unrecognized payload shape means "can't tell from here", which
 * is reported as such rather than being scored as a failure.
 */
function ownerFlag(payload: Record<string, unknown> | null): boolean | null {
  if (!payload) return null;
  if (typeof payload.o === 'boolean') return payload.o;
  if (typeof payload.is_owner === 'boolean') return payload.is_owner as boolean;
  return null;
}

async function probeDmVideo(a: EvalWallet, b: EvalWallet, origin: string): Promise<void> {
  console.log('\n📹 Phase 2 — DM video (Knead gates, wallet-signed)\n');

  const createUrl = `${origin}/api/dm/create-video-room`;
  const tokenUrl = `${origin}/api/dm/generate-dm-token`;

  // A opens the room for the pair.
  const create = await signedPost(a, createUrl, { userId1: a.address, userId2: b.address });
  const roomName: string | null = create.json?.data?.roomName ?? null;

  record({
    phase: 'video',
    label: 'A (contributor) creates a DM video room',
    ok: create.status === 200 && Boolean(roomName),
    expected: '200 with a Daily room',
    actual: `HTTP ${create.status}${roomName ? ` — ${roomName}` : ` — ${errorOf(create)}`}`,
    ms: create.ms,
    detail: { roomUrl: create.json?.data?.roomUrl ?? null },
  });

  if (!roomName) {
    console.log('\n   Skipping the token steps — there is no room to take a token for.');
    return;
  }

  // Both sides take a token. Two participants each holding an owner token for
  // the same room is what "a DM call can happen" means at the API layer.
  for (const wallet of [a, b]) {
    const token = await signedPost(wallet, tokenUrl, { roomName });
    const jwt: string | null = token.json?.data?.token ?? null;
    const payload = decodeDailyToken(jwt ?? '');
    const owner = ownerFlag(payload);

    record({
      phase: 'video',
      label: `${wallet.label} takes a meeting token for the room`,
      ok: token.status === 200 && Boolean(jwt),
      expected: '200 with a Daily meeting token',
      actual: `HTTP ${token.status}${jwt ? ' — token issued' : ` — ${errorOf(token)}`}`,
      ms: token.ms,
      detail: {
        owner: owner === null ? 'not visible in payload' : owner,
        room: payload?.r ?? payload?.room_name ?? null,
      },
    });
  }

  // Controls. These are the steps that make the passes above mean something.
  const stranger = makeUncredentialedWallet();

  const strangerRoom = await signedPost(stranger, createUrl, {
    userId1: stranger.address,
    userId2: a.address,
  });
  record({
    phase: 'video',
    label: 'Control — wallet with no contributor NFT is refused a room',
    ok: strangerRoom.status === 403,
    expected: '403 (contributor status required)',
    actual: `HTTP ${strangerRoom.status} — ${errorOf(strangerRoom)}`,
    ms: strangerRoom.ms,
  });

  const strangerToken = await signedPost(stranger, tokenUrl, { roomName });
  record({
    phase: 'video',
    label: 'Control — wallet with no contributor NFT is refused a token',
    ok: strangerToken.status === 403,
    expected: '403 even knowing the room name',
    actual: `HTTP ${strangerToken.status} — ${errorOf(strangerToken)}`,
    ms: strangerToken.ms,
  });

  const anon = await unauthenticatedPost(tokenUrl, { roomName });
  record({
    phase: 'video',
    label: 'Control — unsigned request is refused',
    ok: anon.status === 401,
    expected: '401 (missing member authentication)',
    actual: `HTTP ${anon.status} — ${errorOf(anon)}`,
    ms: anon.ms,
  });
}

/**
 * Broadcast rights on the live event stage, which is a different gate from DM
 * video: /api/events/generate-token decides HOST / GUEST / VIEWER from the
 * event record, so a wallet is only a broadcaster if the provisioner added it
 * to that event's guest_addresses.
 */
async function probeEventStage(
  wallets: EvalWallet[],
  origin: string,
  roomName: string,
): Promise<void> {
  console.log('\n🎤 Phase 3 — Event stage broadcast rights\n');

  for (const wallet of wallets) {
    const res = await signedPost(wallet, `${origin}/api/events/generate-token`, {
      roomName,
      requireAuth: true,
    });
    const payload = decodeDailyToken(res.json?.data?.token ?? '');
    const owner = ownerFlag(payload);

    record({
      phase: 'video',
      label: `${wallet.label} takes a broadcaster token for ${roomName}`,
      ok: res.status === 200 && owner === true,
      expected: '200 with is_owner true (listed guest or host)',
      actual:
        res.status === 200
          ? `HTTP 200 — owner: ${owner === null ? 'not visible in payload' : owner}`
          : `HTTP ${res.status} — ${errorOf(res)}`,
      ms: res.ms,
    });
  }
}

function errorOf(res: { json: any; text: string }): string {
  return String(res.json?.error ?? res.text.slice(0, 160) ?? '').trim() || '(no body)';
}

// ─── Entry ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const [a, b] = getEvalWalletPair();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Probatio — DM & video probe');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`origin: ${args.origin}`);
  console.log(`${a.label}: ${a.address}`);
  console.log(`${b.label}: ${b.address}`);

  if (!args.skipDm) await probeDmMessaging(a, b, args.timeoutMs);
  if (!args.skipVideo) await probeDmVideo(a, b, args.origin);
  if (args.eventRoom) await probeEventStage([a, b], args.origin, args.eventRoom);

  const failed = results.filter((r) => !r.ok);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!failed.length) {
    // Name only what actually ran. A skipped phase reported as a pass is how a
    // green run stops meaning anything.
    const covered = [
      !args.skipDm && 'DM messaging',
      !args.skipVideo && 'DM video gating',
      args.eventRoom && 'event stage broadcast rights',
    ].filter(Boolean);

    console.log(`\n✅ Verified for two real members: ${covered.join(', ')}.`);
    if (args.skipDm) console.log('   Skipped: DM messaging (--skip-dm).');
    if (args.skipVideo) console.log('   Skipped: DM video (--skip-video).');
    if (!args.skipVideo) {
      console.log('   Not covered: media actually flowing once they join the room.');
    }
    return;
  }

  console.log('\n❌ Failed checks:');
  for (const step of failed) console.log(`   • ${step.label} — ${step.actual}`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n❌ Probe failed to run:', err instanceof Error ? err.message : err);
  process.exit(1);
});
