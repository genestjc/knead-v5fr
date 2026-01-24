import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache to prevent duplicate sponsorships
const recentJoins = new Map<string, number>();

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('🔍 Sponsorship verification request:', body);

    const { userAddress, contractAddress, chainId } = body;

    // 1. Verify correct chain (Base = 8453)
    if (chainId && chainId !== 8453) {
      console.log('❌ Wrong chain:', chainId);
      return NextResponse.json({ 
        shouldSponsor: false // <-- MUST be shouldSponsor
      }, { status: 200 });
    }

    // 2. Verify correct contract (if provided)
    const SPACE_CONTRACT = process.env.NEXT_PUBLIC_KNEAD_SPACE_CONTRACT_ADDRESS?.toLowerCase();
    if (contractAddress && SPACE_CONTRACT && contractAddress.toLowerCase() !== SPACE_CONTRACT) {
      console.log('❌ Wrong contract:', contractAddress);
      return NextResponse.json({ 
        shouldSponsor: false
      }, { status: 200 });
    }

    // 3. Rate limiting - one join per user per day
    if (userAddress) {
      const lastJoin = recentJoins.get(userAddress.toLowerCase());
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;

      if (lastJoin && (now - lastJoin) < ONE_DAY) {
        console.log('⚠️ Rate limited:', userAddress);
        // Optionally, you can deny sponsorship here:
        // return NextResponse.json({ shouldSponsor: false }, { status: 200 });
      } else {
        recentJoins.set(userAddress.toLowerCase(), now);
      }
    }

    console.log('✅ Sponsorship approved');
    return NextResponse.json({ 
      shouldSponsor: true // <-- MUST be shouldSponsor
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Verification error:', error);
    return NextResponse.json({ 
      shouldSponsor: false
    }, { status: 200 });
  }
}
