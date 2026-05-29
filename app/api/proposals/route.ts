import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider(
  process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
);

const ERC1155_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'];

async function isContributor(address: string): Promise<boolean> {
  try {
    const contractAddress = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
    if (!contractAddress) return false;
    const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
    const balances = await Promise.all([1, 2, 3].map(id => contract.balanceOf(address, id)));
    return balances.some((b: ethers.BigNumber) => b.gt(0));
  } catch {
    return false;
  }
}

async function isPremiumMember(address: string): Promise<boolean> {
  try {
    const contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!,
      ERC1155_ABI,
      provider,
    );
    const balance = await contract.balanceOf(address, 1);
    return balance.gt(0);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const viewerAddress = searchParams.get('viewer') || '';

  const supabase = getSupabaseAdmin();
  const { data: proposals, error } = await supabase
    .from('proposals')
    .select('id, title, description, items, vote_threshold, vote_count, status, created_by, created_at')
    .in('status', ['open', 'triggered', 'executing', 'executed'])
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If viewer address provided, attach their votes and contributor status
  let votedIds = new Set<string>();
  let viewerIsContributor = false;
  if (viewerAddress) {
    const [votesResult] = await Promise.all([
      supabase
        .from('proposal_votes')
        .select('proposal_id')
        .eq('voter_address', viewerAddress.toLowerCase()),
      isContributor(viewerAddress).then(v => { viewerIsContributor = v; }),
    ]);
    votedIds = new Set((votesResult.data ?? []).map((v: any) => v.proposal_id));
  }

  const enriched = (proposals ?? []).map((p: any) => ({
    ...p,
    user_has_voted: votedIds.has(p.id),
  }));

  return NextResponse.json({ proposals: enriched, viewer_is_contributor: viewerIsContributor });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.description || !body?.address) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const address = body.address as string;
  const email = typeof body.email === 'string' && body.email.includes('@') ? body.email.trim() : null;

  const eligible = await isPremiumMember(address);
  if (!eligible) {
    return NextResponse.json({ error: 'Knead Monthly membership required to submit proposals' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('proposals')
    .insert({
      title: body.title,
      description: body.description,
      items: [{ type: 'request', description: body.request || body.description }],
      vote_threshold: 3,
      status: 'pending',
      created_by: address.toLowerCase(),
    })
    .select('id, title')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (email) {
    const { sendEmail } = await import('@/lib/sendEmail');
    await sendEmail({
      to: email,
      subject: `Your proposal has been submitted — ${data.title}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #111;">
          <p style="font-size: 22px; font-weight: bold; margin-bottom: 8px;">Your proposal is live.</p>
          <p style="font-size: 16px; color: #555; margin-bottom: 24px;">The Knead community will now review and vote on it.</p>
          <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="font-size: 18px; font-weight: bold; margin: 0 0 8px;">${data.title}</p>
            <p style="font-size: 14px; color: #6b7280; margin: 0;">${body.description}</p>
          </div>
          <p style="font-size: 14px; color: #9ca3af;">Once enough contributors vote in favour, the Knead agent will execute it automatically.</p>
          <p style="font-size: 12px; color: #d1d5db; margin-top: 32px;">Knead Magazine · kneadmag.com</p>
        </div>
      `,
    }).catch(() => {}); // non-blocking
  }

  return NextResponse.json({ proposal: data }, { status: 201 });
}
