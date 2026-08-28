/**
 * The two credentialed test wallets Probatio drives DM and video calls with.
 *
 * DM messaging and DM video are contributor-to-contributor features, so
 * nothing about them can be exercised by a single actor: /api/dm/create-video-room
 * needs one contributor to open the room and /api/dm/generate-dm-token needs the
 * *other* one to take a token for it. Two wallets, both fully credentialed, is
 * the smallest set that covers the real path.
 *
 * These are real wallets holding real NFTs on Base — the gates they pass are
 * the production gates (`isContributor` reads the chain), not a test double.
 * That is the point: a run that passes here is evidence the feature works.
 *
 * Provision them with `npx tsx scripts/provision-eval-wallets.ts`; drive them
 * with `npx tsx scripts/probe-dm-video.ts`.
 *
 * SECURITY NOTES
 *   • These keys live in env vars and are never committed. `--generate` prints
 *     them once; storing them is the operator's job.
 *   • Keep them OFF the admin list. `getWalletAgentRole` gates the payments
 *     agent on admin, so a test wallet that is only a contributor cannot move
 *     money no matter what a driver model asks it to do. The refusal is
 *     testable; the spend is not reachable.
 *   • Anything holding these keys can post as a member. Treat them like any
 *     other production credential.
 */
import { ethers } from 'ethers';
import { WALLET_AUTH_HEADERS, buildWalletAuthMessage } from '@/lib/auth/wallet-message';
import { canonicalRequestPath, sha256Hex } from '@/lib/auth/request-binding';

export type EvalWalletId = 'a' | 'b';

export interface EvalWallet {
  id: EvalWalletId;
  /** Shown in transcripts and used as the chat_users alias. */
  label: string;
  /** Lowercase, matching how every route stores and compares addresses. */
  address: string;
  privateKey: string;
}

export const EVAL_WALLET_ENV: Record<EvalWalletId, string> = {
  a: 'PROBATIO_EVAL_WALLET_A_PRIVATE_KEY',
  b: 'PROBATIO_EVAL_WALLET_B_PRIVATE_KEY',
};

export const EVAL_WALLET_LABEL: Record<EvalWalletId, string> = {
  a: 'Probatio A',
  b: 'Probatio B',
};

/** Alias written to chat_users so these are obvious in the member list. */
export function evalWalletAlias(id: EvalWalletId): string {
  return EVAL_WALLET_LABEL[id];
}

export function hasEvalWallets(): boolean {
  return Boolean(process.env[EVAL_WALLET_ENV.a] && process.env[EVAL_WALLET_ENV.b]);
}

/**
 * Load one test wallet from the environment.
 *
 * Throws naming the missing variable rather than returning null — every caller
 * is a script or a probe that cannot do anything useful without it, and a
 * silent skip would read as a passing run.
 */
export function getEvalWallet(id: EvalWalletId): EvalWallet {
  const envName = EVAL_WALLET_ENV[id];
  const key = process.env[envName];

  if (!key) {
    throw new Error(
      `${envName} is not set. Run "npx tsx scripts/provision-eval-wallets.ts --generate" ` +
        'to create the two test wallets, store both keys, then run the provisioner without --generate.',
    );
  }

  let wallet: ethers.Wallet;
  try {
    wallet = new ethers.Wallet(key.trim());
  } catch {
    throw new Error(`${envName} is not a valid private key.`);
  }

  return {
    id,
    label: EVAL_WALLET_LABEL[id],
    address: wallet.address.toLowerCase(),
    privateKey: wallet.privateKey,
  };
}

export function getEvalWalletPair(): [EvalWallet, EvalWallet] {
  return [getEvalWallet('a'), getEvalWallet('b')];
}

/**
 * Build the six `x-wallet-*` headers that `verifyWalletRequest` checks.
 *
 * The signed message binds method, path and body hash, so it has to be built
 * from the exact bytes being sent — hence taking the serialized body rather
 * than an object. Any drift from `buildWalletAuthMessage` fails as an invalid
 * signature, which is why both sides import the same builder.
 */
export async function signWalletAuthHeaders(args: {
  privateKey: string;
  method: string;
  url: string;
  /** The serialized request body, byte-for-byte as it will be sent. */
  body?: string;
}): Promise<Record<string, string>> {
  const wallet = new ethers.Wallet(args.privateKey);
  const address = wallet.address.toLowerCase();
  const method = args.method.toUpperCase();
  const path = canonicalRequestPath(args.url);
  const timestamp = String(Date.now());

  // GET and HEAD are hashed as an empty body server-side regardless of what
  // was sent, so mirror that rather than hashing whatever we were handed.
  const bodyHash = await sha256Hex(method === 'GET' || method === 'HEAD' ? '' : (args.body ?? ''));

  const signature = await wallet.signMessage(
    buildWalletAuthMessage(address, timestamp, { method, path, bodyHash }),
  );

  return {
    [WALLET_AUTH_HEADERS.address]: address,
    [WALLET_AUTH_HEADERS.timestamp]: timestamp,
    [WALLET_AUTH_HEADERS.method]: method,
    [WALLET_AUTH_HEADERS.path]: path,
    [WALLET_AUTH_HEADERS.bodyHash]: bodyHash,
    [WALLET_AUTH_HEADERS.signature]: signature,
  };
}

/**
 * POST as a test wallet, authenticated exactly the way the browser does.
 *
 * Returns the parsed JSON alongside status and latency so a probe step can be
 * logged in the same shape as every other Probatio behavior log.
 */
export async function signedPost(
  wallet: Pick<EvalWallet, 'privateKey'>,
  url: string,
  body: unknown,
): Promise<ProbeResponse> {
  const serialized = JSON.stringify(body ?? {});
  const headers = await signWalletAuthHeaders({
    privateKey: wallet.privateKey,
    method: 'POST',
    url,
    body: serialized,
  });

  return readResponse(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: serialized,
  });
}

/**
 * POST with no wallet authentication at all — the 401 control.
 *
 * A gate that only ever sees credentialed callers has not been shown to be a
 * gate, so the probes send this too.
 */
export async function unauthenticatedPost(
  url: string,
  body: unknown,
): Promise<ProbeResponse> {
  return readResponse(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

export interface ProbeResponse {
  /** HTTP status, or 0 when the request never got a response at all. */
  status: number;
  json: any;
  text: string;
  ms: number;
}

/**
 * Send a request and describe what came back, including nothing.
 *
 * A network failure is reported as status 0 rather than thrown: an unreachable
 * origin is a result the probe should print alongside the others, not an
 * exception that abandons the remaining checks.
 */
async function readResponse(url: string, init: RequestInit): Promise<ProbeResponse> {
  const started = Date.now();

  try {
    const res = await fetch(url, { ...init, cache: 'no-store' });
    const ms = Date.now() - started;
    const text = await res.text();

    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON body — the raw text is kept for the log */
    }

    return { status: res.status, json, text, ms };
  } catch (err) {
    return {
      status: 0,
      json: null,
      text: `network error: ${err instanceof Error ? err.message : String(err)}`,
      ms: Date.now() - started,
    };
  }
}

/**
 * A throwaway wallet holding nothing — the 403 control.
 *
 * Random per call and never funded or minted to, so it proves the contributor
 * check is what let A and B through rather than the route being open.
 */
export function makeUncredentialedWallet(): EvalWallet {
  const wallet = ethers.Wallet.createRandom();
  return {
    id: 'a',
    label: 'Uncredentialed control',
    address: wallet.address.toLowerCase(),
    privateKey: wallet.privateKey,
  };
}
