import { NextRequest, NextResponse } from 'next/server';
import { createThirdwebClient, getContract, readContract } from 'thirdweb';
import { base } from 'thirdweb/chains';

const MEMBERSHIP_CONTRACT = '0x616843F796B43E6ef972e7C345D2B06d85513543';

export async function POST(req: NextRequest) {
  try {
    const { userAddress } = await req.json();

    if (!userAddress) {
      return NextResponse.json({ error: 'Missing userAddress' }, { status: 400 });
    }

    const client = createThirdwebClient({
      clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
    });

    const contract = getContract({
      client,
      chain: base,
      address: MEMBERSHIP_CONTRACT,
    });

    // Check user's balance
    const balance = await readContract({
      contract,
      method: 'function balanceOf(address) view returns (uint256)',
      params: [userAddress],
    });

    // Check total supply (actual member count)
    const totalSupply = await readContract({
      contract,
      method: 'function totalSupply() view returns (uint256)',
      params: [],
    });

    const hasMembership = balance > 0n;
    const totalMembers = Number(totalSupply);
    const isUnder100 = totalMembers < 100;

    console.log('📊 Membership Check:', {
      user: userAddress.slice(0, 8) + '...',
      hasMembership,
      totalMembers,
      isUnder100,
      shouldBeFreeMint: !hasMembership && isUnder100,
    });

    return NextResponse.json({
      success: true,
      hasMembership,
      balance: balance.toString(),
      totalMembers,
      isUnder100,
      shouldBeFreeMint: !hasMembership && isUnder100,
    });

  } catch (error: any) {
    console.error('❌ Membership check failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
