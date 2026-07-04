import type { NextRequest } from 'next/server';

/**
 * Lightweight, dependency-free rate limiter.
 *
 * When `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are configured it
 * uses Upstash's REST API (a fixed-window counter) so limits are shared across
 * every serverless instance. When they are not set it falls back to a
 * best-effort in-memory counter — per-instance and reset on cold start, so only
 * a partial defense, but better than nothing for local/dev.
 *
 * We deliberately avoid the `@upstash/ratelimit` package so this adds no build
 * dependency and never breaks the bundle when Upstash isn't installed.
 *
 * Failure policy is fail-open: if Redis errors or times out we allow the
 * request (availability over strictness) and log it. The per-route auth /
 * signature checks remain the primary control; this is defense-in-depth against
 * volumetric abuse (gas drain, LLM cost).
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const upstashConfigured = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

let warnedNoUpstash = false;

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

// ---- in-memory fallback (per instance) ----
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + opts.windowSeconds * 1000 });
    return { success: true, remaining: opts.limit - 1 };
  }
  existing.count += 1;
  return { success: existing.count <= opts.limit, remaining: Math.max(0, opts.limit - existing.count) };
}

// Opportunistically evict expired in-memory keys so the Map can't grow forever.
function sweepMemory() {
  if (memoryStore.size < 10_000) return;
  const now = Date.now();
  for (const [k, v] of memoryStore) if (v.resetAt <= now) memoryStore.delete(k);
}

async function upstashLimit(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
  const windowStart = Math.floor(Date.now() / (opts.windowSeconds * 1000));
  const redisKey = `ratelimit:${key}:${windowStart}`;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['EXPIRE', redisKey, opts.windowSeconds],
      ]),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const data = (await res.json()) as Array<{ result: number }>;
    const count = data?.[0]?.result ?? 0;
    return { success: count <= opts.limit, remaining: Math.max(0, opts.limit - count) };
  } catch (err) {
    // Fail open — don't take down a real feature because Redis hiccuped.
    console.error('[rate-limit] Upstash error, allowing request:', (err as Error).message);
    return { success: true, remaining: opts.limit };
  }
}

/**
 * Consume one token for `identifier` (e.g. an IP or wallet address) under a
 * named `bucket` (e.g. 'onboard', 'demeter-chat'). Returns whether the request
 * is allowed.
 */
export async function rateLimit(
  bucket: string,
  identifier: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const key = `${bucket}:${identifier}`;
  if (upstashConfigured) return upstashLimit(key, opts);

  if (!warnedNoUpstash) {
    warnedNoUpstash = true;
    console.warn(
      '[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — using per-instance in-memory limiting only. ' +
        'Set them for durable, cross-instance rate limits in production.',
    );
  }
  sweepMemory();
  return memoryLimit(key, opts);
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}
