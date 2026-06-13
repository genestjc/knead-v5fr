import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req, { requireMaster: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('proposals')
    .select('id, title, description, created_by, created_at, status, vote_threshold')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposals: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAdminRequest(req, { requireMaster: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await req.json().catch(() => null);
  if (!body?.id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('proposals').delete().eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdminRequest(req, { requireMaster: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.status) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!['open', 'rejected'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const updatePayload: Record<string, unknown> = { status: body.status };
  if (
    body.status === 'open' &&
    typeof body.vote_threshold === 'number' &&
    Number.isInteger(body.vote_threshold) &&
    body.vote_threshold >= 1 &&
    body.vote_threshold <= 50
  ) {
    updatePayload.vote_threshold = body.vote_threshold;
  }

  const { error } = await supabase
    .from('proposals')
    .update(updatePayload)
    .eq('id', body.id)
    .eq('status', 'pending');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
