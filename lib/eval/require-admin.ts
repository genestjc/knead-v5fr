/**
 * Auth gate for /api/probatio/* routes.
 *
 * Normally this is just verifyAdminRequest — the same wallet-signature check
 * every other admin endpoint uses. When PROBATIO_DEMO_MODE is on it short
 * circuits to an authorized result so the console can be demoed without a
 * wallet. Routing every probatio route through this one function means the
 * bypass has exactly one home, and turning it off restores real auth
 * everywhere at once.
 */
import type { NextRequest } from 'next/server';
import {
  verifyAdminRequest,
  type AdminAuthResult,
  type VerifyAdminOptions,
} from '@/lib/admin/verify-admin-request';
import { PROBATIO_DEMO_MODE, DEMO_ACTOR } from './demo-mode';

export async function requireProbatioAdmin(
  req: NextRequest,
  opts: VerifyAdminOptions = {},
): Promise<AdminAuthResult> {
  if (PROBATIO_DEMO_MODE) {
    return { ok: true, address: DEMO_ACTOR, role: 'master-admin' };
  }
  return verifyAdminRequest(req, opts);
}
