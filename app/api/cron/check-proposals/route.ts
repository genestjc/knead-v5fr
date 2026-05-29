import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { runAgent } from '@/lib/agent';
import { postToTownsChannel } from '@/lib/towns/agent-listener';

export const dynamic = 'force-dynamic';

function authenticate(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

function buildCommand(proposal: any): string {
  const items = (proposal.items as any[]).map((item: any, i: number) => {
    if (item.type === 'usdc') return `${i + 1}. Pay ${item.amount_usdc} USDC to ${item.recipient_address}${item.notes ? ` for: ${item.notes}` : ''}`;
    if (item.type === 'merch') return `${i + 1}. Send merch (${item.product_handle ?? 'knead-merch'}) × ${item.quantity ?? 1} to ${item.recipient_name ?? item.recipient_address}${item.shipping_address ? ` — ship to ${JSON.stringify(item.shipping_address)}` : ''}`;
    if (item.type === 'magazine') return `${i + 1}. Send magazine to ${item.recipient_name ?? item.recipient_address}${item.shipping_address ? ` — ship to ${JSON.stringify(item.shipping_address)}` : ''}`;
    return `${i + 1}. ${JSON.stringify(item)}`;
  });
  return `Execute approved proposal: "${proposal.title}".\nItems:\n${items.join('\n')}\nPost a summary when done.`;
}

export async function POST(req: NextRequest) {
  if (!authenticate(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: proposals, error } = await supabase
    .from('proposals')
    .select('id, title, description, items, created_by, vote_threshold, vote_count')
    .eq('status', 'open');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ready = (proposals ?? []).filter((p: any) => p.vote_count >= p.vote_threshold);
  if (ready.length === 0) return NextResponse.json({ message: 'No proposals ready', count: 0 });

  const results = [];
  for (const proposal of ready) {
    const { data: claimed } = await supabase.from('proposals').update({ status: 'triggered', triggered_at: new Date().toISOString() }).eq('id', proposal.id).eq('status', 'open').select('id').single();
    if (!claimed) continue;

    await supabase.from('proposals').update({ status: 'executing' }).eq('id', proposal.id);

    const result = await runAgent(
      { command: buildCommand(proposal), senderAddress: proposal.created_by || '0x0000000000000000000000000000000000000000', proposalId: proposal.id },
      postToTownsChannel,
    ).catch((err: Error) => ({ success: false, summary: err.message, actionsCompleted: [], errors: [err.message] }));

    await supabase.from('proposals').update({ status: result.success ? 'executed' : 'failed', executed_at: new Date().toISOString(), execution_result: result }).eq('id', proposal.id);
    results.push({ id: proposal.id, success: result.success, summary: result.summary });
  }

  return NextResponse.json({ message: 'Done', count: results.length, results });
}

export async function GET() {
  return NextResponse.json({ status: 'ready', message: 'Use POST with Bearer CRON_SECRET to trigger.' });
}
