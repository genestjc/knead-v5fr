import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

const MASTER_ADMIN = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET?.toLowerCase();

function isAdmin(address: string): boolean {
  return !!MASTER_ADMIN && address.toLowerCase() === MASTER_ADMIN;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const adminAddress = searchParams.get('adminAddress') || '';

  if (!isAdmin(adminAddress)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('proposals')
    .select('id, title, description, created_by, created_at, status')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposals: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.status || !body?.adminAddress) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!isAdmin(body.adminAddress)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  if (!['open', 'rejected'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('proposals')
    .update({ status: body.status })
    .eq('id', body.id)
    .eq('status', 'pending');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
