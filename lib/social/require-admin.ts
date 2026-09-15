/**
 * Auth gate for /api/social/* routes.
 *
 * Structurally the same as lib/eval/require-admin.ts — one function every
 * route goes through, so the gate has exactly one home, and flipping the demo
 * flag restores real auth everywhere at once.
 *
 * The flag itself lives in ./demo-mode so the client console can read it
 * without pulling viem and the service-role Supabase client into the browser
 * bundle. That file is also where the reasoning about why it defaults to false
 * is written down.
 */
import type { NextRequest } from 'next/server';
import {
  verifyAdminRequest,
  type AdminAuthResult,
  type VerifyAdminOptions,
} from '@/lib/admin/verify-admin-request';
import { SOCIAL54_DEMO_MODE, DEMO_ACTOR } from './demo-mode';

export async function requireSocialAdmin(
  req: NextRequest,
  opts: VerifyAdminOptions = {},
): Promise<AdminAuthResult> {
  if (SOCIAL54_DEMO_MODE) {
    return { ok: true, address: DEMO_ACTOR, role: 'master-admin' };
  }
  return verifyAdminRequest(req, opts);
}
