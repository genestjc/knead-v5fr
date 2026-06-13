import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// POST — grant passes to a list of addresses
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req, { requireMaster: true });
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { eventId, addresses } = await req.json();

    if (!eventId || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing eventId or addresses' }, { status: 400 });
    }

    const rows = addresses.map((addr: string) => ({
      event_id: eventId,
      wallet_address: addr.toLowerCase(),
      status: 'active',
    }));

    const { error, count } = await getSupabase()
      .from('event_passes')
      .upsert(rows, { onConflict: 'event_id,wallet_address', ignoreDuplicates: false })
      .select();

    if (error) {
      console.error('[POST /api/admin/event-passes]', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log(`[event-passes] Granted ${addresses.length} passes for event ${eventId}`);
    return NextResponse.json({ success: true, data: { count: addresses.length } });
  } catch (err: any) {
    console.error('[POST /api/admin/event-passes]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE — revoke (burn) passes for a list of addresses
export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req, { requireMaster: true });
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { eventId, addresses } = await req.json();

    if (!eventId || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing eventId or addresses' }, { status: 400 });
    }

    const normalised = addresses.map((a: string) => a.toLowerCase());

    const { error } = await getSupabase()
      .from('event_passes')
      .update({ status: 'burned', burned_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .in('wallet_address', normalised);

    if (error) {
      console.error('[DELETE /api/admin/event-passes]', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log(`[event-passes] Burned ${addresses.length} passes for event ${eventId}`);
    return NextResponse.json({ success: true, data: { count: addresses.length } });
  } catch (err: any) {
    console.error('[DELETE /api/admin/event-passes]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
