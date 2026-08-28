import 'dotenv/config';
import { ethers } from 'ethers';
import {
  EVAL_WALLET_ENV,
  EVAL_WALLET_LABEL,
  evalWalletAlias,
  getEvalWallet,
  type EvalWallet,
  type EvalWalletId,
} from '@/lib/eval/eval-wallets';

/**
 * Provision the two credentialed test wallets Probatio uses to exercise DM and
 * video calling end to end.
 *
 * Both wallets come out holding every credential the chat gates read:
 *
 *   Knead Membership #0 (freemium)   — base membership
 *   Knead Membership #1 (Knead Monthly) — participant tier
 *   Contributor #1 (appointed)       — contributor tier: DM, DM video, tipping
 *   chat_users row                   — an identity in the member list
 *   [--event <id>] guest_addresses   — broadcast rights in that live event
 *   [--event <id>] event_passes row  — access during a pass-only event
 *
 * Everything here is real: real mints on Base, read back by the same
 * `isContributor` / `getUserRole` calls the routes use. Nothing is stubbed, so
 * a probe that passes against these wallets is evidence about production.
 *
 * Usage
 *   npx tsx scripts/provision-eval-wallets.ts --generate
 *       Create two fresh keypairs and print them. Writes nothing, spends
 *       nothing. Store both keys in the env, then run again without --generate.
 *
 *   npx tsx scripts/provision-eval-wallets.ts [--event <eventId>] [--dry-run]
 *       Mint and record everything missing for both wallets, then verify by
 *       reading roles back off-chain-of-truth. Safe to re-run: every step
 *       checks before it writes.
 *
 * Requires: THIRDWEB_SECRET_KEY, ENGINE_SERVER_WALLET_ADDRESS,
 * ENGINE_VAULT_ACCESS_TOKEN, NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
 * NEXT_PUBLIC_NFT_CONTRACT_ADDRESS, NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS,
 * NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Deliberately NOT done here: adding these wallets to the rewards contract.
 * The real contributor flow (/api/admin/mint-contributor) also calls
 * addContributorToRewards with a weekly TOWNS budget. Test wallets get the
 * access credential, not a payout allocation.
 */

const REQUIRED_ENV = [
  'THIRDWEB_SECRET_KEY',
  'ENGINE_SERVER_WALLET_ADDRESS',
  'ENGINE_VAULT_ACCESS_TOKEN',
  'NEXT_PUBLIC_THIRDWEB_CLIENT_ID',
  'NEXT_PUBLIC_NFT_CONTRACT_ADDRESS',
  'NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const WALLET_IDS: EvalWalletId[] = ['a', 'b'];

/** Contributor tier minted to the test wallets. Token ID 1 on the contributor contract. */
const CONTRIBUTOR_ROLE = 'appointed' as const;

/** How long to wait for an Engine-enqueued mint to actually land on-chain. */
const CONFIRM_TIMEOUT_MS = 180_000;
const CONFIRM_POLL_MS = 5_000;

interface Args {
  generate: boolean;
  dryRun: boolean;
  eventId: string | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { generate: false, dryRun: false, eventId: null };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--generate') args.generate = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--event') args.eventId = argv[++i] ?? null;
    else if (arg.startsWith('--event=')) args.eventId = arg.slice('--event='.length);
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  if (args.eventId !== null && !args.eventId) {
    console.error('--event needs an event id: --event <eventId>');
    process.exit(1);
  }

  return args;
}

function banner(title: string): void {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(title);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Print two fresh keypairs and stop.
 *
 * Nothing is written to disk — a private key in a file in the repo is a private
 * key in the repo's history sooner or later. The operator copies these into the
 * env store themselves; this is the only time they are ever displayed.
 */
function generate(): void {
  banner('🔑 New Probatio test wallets');

  console.log('Store these in your env (Vercel / Render / .env.local), then re-run');
  console.log('this script without --generate to mint their credentials.\n');

  for (const id of WALLET_IDS) {
    const wallet = ethers.Wallet.createRandom();
    console.log(`${EVAL_WALLET_LABEL[id]}`);
    console.log(`  address: ${wallet.address}`);
    console.log(`  ${EVAL_WALLET_ENV[id]}=${wallet.privateKey}\n`);
  }

  console.log('⚠️  These keys are shown once and not saved anywhere.');
  console.log('⚠️  Keep them off the admin allowlist — a test wallet must not be able');
  console.log('    to run payments-agent commands.');
}

function preflight(): void {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error('❌ Missing required environment variables:\n');
    for (const name of missing) console.error(`   ${name}`);
    process.exit(1);
  }
}

/**
 * Poll an on-chain read until it reports what we just minted.
 *
 * Engine enqueues transactions, so a mint call returning successfully means
 * "accepted", not "landed". The gates read the chain, so the chain is what has
 * to be confirmed — anything less and the provisioner reports credentials the
 * routes cannot yet see.
 */
async function waitFor(
  label: string,
  check: () => Promise<boolean>,
): Promise<boolean> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return true;
    process.stdout.write('.');
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_POLL_MS));
  }

  console.log('');
  console.warn(`   ⚠️  ${label} did not confirm within ${CONFIRM_TIMEOUT_MS / 1000}s.`);
  console.warn('      The transaction may still be pending — re-run to re-check.');
  return false;
}

async function provisionMembership(wallet: EvalWallet, dryRun: boolean): Promise<void> {
  const { balanceOf } = await import('thirdweb/extensions/erc1155');
  const { getContract } = await import('thirdweb');
  const { base } = await import('thirdweb/chains');
  const { client } = await import('@/thirdweb-server-wallet');
  const { mintFreemiumNFT, mintPremiumNFT } = await import('@/lib/nftActions');

  const contract = getContract({
    client,
    address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!,
    chain: base,
  });

  const tiers = [
    { tokenId: 0n, name: 'Membership #0 (freemium)', mint: mintFreemiumNFT },
    { tokenId: 1n, name: 'Membership #1 (Knead Monthly)', mint: mintPremiumNFT },
  ];

  for (const tier of tiers) {
    const owned = await balanceOf({ contract, owner: wallet.address, tokenId: tier.tokenId });

    if (owned > 0n) {
      console.log(`   ✓ ${tier.name} — already held`);
      continue;
    }

    if (dryRun) {
      console.log(`   → ${tier.name} — WOULD MINT`);
      continue;
    }

    console.log(`   • ${tier.name} — minting`);
    await tier.mint(wallet.address);

    process.stdout.write('     confirming');
    const confirmed = await waitFor(tier.name, async () => {
      const balance = await balanceOf({ contract, owner: wallet.address, tokenId: tier.tokenId });
      return balance > 0n;
    });
    if (confirmed) console.log(' confirmed');
  }
}

async function provisionContributor(wallet: EvalWallet, dryRun: boolean): Promise<void> {
  const { isContributor } = await import('@/lib/blockchain/check-nft-ownership');
  const { mintContributorNFT } = await import('@/lib/blockchain/contributor-nft');

  const before = await isContributor(wallet.address);
  if (before.isContributor) {
    console.log(`   ✓ Contributor #${before.tokenId} — already held`);
    return;
  }

  if (dryRun) {
    console.log(`   → Contributor #1 (${CONTRIBUTOR_ROLE}) — WOULD MINT`);
    return;
  }

  console.log(`   • Contributor #1 (${CONTRIBUTOR_ROLE}) — minting`);
  // adminAddress is used for the mint's log line only; the Engine server wallet
  // is what actually signs, so naming the script is more truthful than pasting
  // a human admin's address onto a machine-initiated mint.
  await mintContributorNFT(wallet.address, CONTRIBUTOR_ROLE, 'provision-eval-wallets');

  process.stdout.write('     confirming');
  const confirmed = await waitFor('Contributor NFT', async () => {
    const now = await isContributor(wallet.address);
    return now.isContributor;
  });
  if (confirmed) console.log(' confirmed');
}

/**
 * Give the wallet an identity in the member list.
 *
 * Not a gate — `/api/dm/*` reads the chain, not this table — but the DM list,
 * the event host lookup, and every "who is this" render go through chat_users,
 * so a wallet without a row shows up as a bare hex string and cannot be
 * selected as an event host.
 */
async function provisionChatUser(wallet: EvalWallet, dryRun: boolean): Promise<void> {
  const { getSupabaseAdmin } = await import('@/lib/supabase/server');
  const supabase = getSupabaseAdmin();

  const { data: existing, error } = await supabase
    .from('chat_users')
    .select('id, alias, role, membership_tier')
    .eq('address', wallet.address)
    .maybeSingle();

  if (error) throw new Error(`chat_users lookup failed: ${error.message}`);

  const desired = {
    alias: evalWalletAlias(wallet.id),
    role: 'contributor',
    membership_tier: 'premium',
    contributor_type: CONTRIBUTOR_ROLE,
    is_banned: false,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const inSync =
      existing.alias === desired.alias &&
      existing.role === desired.role &&
      existing.membership_tier === desired.membership_tier;

    if (inSync) {
      console.log(`   ✓ chat_users row — already correct (${existing.id})`);
      return;
    }

    if (dryRun) {
      console.log('   → chat_users row — WOULD UPDATE');
      return;
    }

    const { error: updateError } = await supabase
      .from('chat_users')
      .update(desired)
      .eq('id', existing.id);
    if (updateError) throw new Error(`chat_users update failed: ${updateError.message}`);

    console.log(`   • chat_users row — updated (${existing.id})`);
    return;
  }

  if (dryRun) {
    console.log('   → chat_users row — WOULD CREATE');
    return;
  }

  const { data: created, error: insertError } = await supabase
    .from('chat_users')
    .insert({
      address: wallet.address,
      created_at: new Date().toISOString(),
      ...desired,
    })
    .select('id')
    .single();

  if (insertError || !created) {
    throw new Error(`chat_users insert failed: ${insertError?.message ?? 'no row returned'}`);
  }

  console.log(`   • chat_users row — created (${created.id})`);
}

/**
 * Make both wallets special guests of one event.
 *
 * Two separate credentials, and they are not interchangeable:
 *   guest_addresses  → /api/events/generate-token issues a broadcaster token
 *                      (is_owner), which is what "can appear on the video
 *                      stage" actually means.
 *   event_passes     → /api/chat/permissions lets them post during a
 *                      pass-only event, when even contributors are locked out.
 *
 * Both are rows rather than mints, which makes them revocable — the only
 * credential in this script that can be taken back without a burn.
 */
async function provisionEventGuest(
  wallets: EvalWallet[],
  eventId: string,
  dryRun: boolean,
): Promise<void> {
  const { getSupabaseAdmin } = await import('@/lib/supabase/server');
  const supabase = getSupabaseAdmin();

  const { data: event, error } = await supabase
    .from('chat_events')
    .select('id, title, status, guest_addresses, daily_room_name')
    .eq('id', eventId)
    .maybeSingle();

  if (error) throw new Error(`chat_events lookup failed: ${error.message}`);
  if (!event) throw new Error(`No event with id ${eventId}`);

  console.log(`\n🎫 Event: ${event.title} (${event.status})`);
  console.log(`   room: ${event.daily_room_name ?? '(no Daily room yet)'}`);

  const current: string[] = (event.guest_addresses ?? []).map((a: string) => a.toLowerCase());
  const missing = wallets.map((w) => w.address).filter((a) => !current.includes(a));

  if (!missing.length) {
    console.log('   ✓ guest_addresses — both wallets already listed');
  } else if (dryRun) {
    console.log(`   → guest_addresses — WOULD ADD ${missing.join(', ')}`);
  } else {
    const { error: updateError } = await supabase
      .from('chat_events')
      .update({ guest_addresses: [...current, ...missing] })
      .eq('id', eventId);
    if (updateError) throw new Error(`guest_addresses update failed: ${updateError.message}`);
    console.log(`   • guest_addresses — added ${missing.join(', ')}`);
  }

  for (const wallet of wallets) {
    const { data: pass } = await supabase
      .from('event_passes')
      .select('id, status')
      .eq('event_id', eventId)
      .eq('wallet_address', wallet.address)
      .maybeSingle();

    if (pass?.status === 'active') {
      console.log(`   ✓ event pass — ${wallet.label} already holds an active pass`);
      continue;
    }

    if (dryRun) {
      console.log(`   → event pass — WOULD ISSUE to ${wallet.label}`);
      continue;
    }

    if (pass) {
      const { error: reviveError } = await supabase
        .from('event_passes')
        .update({ status: 'active' })
        .eq('id', pass.id);
      if (reviveError) throw new Error(`event_passes update failed: ${reviveError.message}`);
      console.log(`   • event pass — reactivated for ${wallet.label}`);
      continue;
    }

    const { error: passError } = await supabase.from('event_passes').insert({
      event_id: eventId,
      wallet_address: wallet.address,
      status: 'active',
    });
    if (passError) throw new Error(`event_passes insert failed: ${passError.message}`);
    console.log(`   • event pass — issued to ${wallet.label}`);
  }
}

/** Read every gate back the way the routes read it, and report what it says. */
async function verify(wallet: EvalWallet): Promise<boolean> {
  const { getUserRole } = await import('@/lib/blockchain/check-nft-ownership');

  // force=true: the role cache holds for 5 minutes, which is longer than this
  // script takes, so a cached pre-mint answer would report a false failure.
  const role = await getUserRole(wallet.address, true);

  const ok = role.role === 'contributor';
  const mark = ok ? '✅' : '❌';

  console.log(`${mark} ${wallet.label}  ${wallet.address}`);
  console.log(`     role: ${role.role}`);
  console.log(`     Knead Monthly: ${role.hasKneadMonthly ? 'yes' : 'no'}`);
  console.log(
    `     contributor: ${role.hasContributor ? `yes (token #${role.contributorTokenId})` : 'no'}`,
  );
  console.log(`     DM + DM video: ${ok ? 'allowed' : 'BLOCKED — contributor status required'}`);

  return ok;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.generate) {
    generate();
    return;
  }

  preflight();

  banner('🧪 Provisioning Probatio test wallets');
  if (args.dryRun) console.log('DRY RUN — nothing will be minted or written.\n');

  const wallets = WALLET_IDS.map(getEvalWallet);

  for (const wallet of wallets) {
    console.log(`\n👤 ${wallet.label}  ${wallet.address}`);
    await provisionMembership(wallet, args.dryRun);
    await provisionContributor(wallet, args.dryRun);
    await provisionChatUser(wallet, args.dryRun);
  }

  if (args.eventId) {
    await provisionEventGuest(wallets, args.eventId, args.dryRun);
  }

  if (args.dryRun) {
    console.log('\nDry run complete — re-run without --dry-run to apply.');
    return;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Verifying against the live gates');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = await Promise.all(wallets.map(verify));

  if (results.every(Boolean)) {
    console.log('\n✅ Both wallets are fully credentialed.');
    console.log('   Next: npx tsx scripts/probe-dm-video.ts --origin https://kneadmag.com');
    return;
  }

  console.error('\n❌ At least one wallet is not a contributor yet.');
  console.error('   Engine mints confirm in 30–60s — re-run this script to re-check.');
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n❌ Provisioning failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
