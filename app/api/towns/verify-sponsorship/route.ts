import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache to prevent duplicate sponsorships
// In production, use Redis or database
const recentJoins = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const { userAddress, contractAddress, chainId } = await req.json();

    console.log('🔍 Sponsorship verification request:', {
      userAddress,
      contractAddress,
      chainId,
    });

    // 1. Verify correct chain (Base = 8453)
    if (chainId !== 8453) {
      console.log('❌ Wrong chain:', chainId);
      return NextResponse.json({ 
        shouldSponsor: false,
        reason: 'Only Base chain is supported'
      });
    }

    // 2. Verify correct contract
    const SPACE_CONTRACT = process.env.NEXT_PUBLIC_KNEAD_SPACE_CONTRACT_ADDRESS?.toLowerCase();
    if (contractAddress.toLowerCase() !== SPACE_CONTRACT) {
      console.log('❌ Wrong contract:', contractAddress);
      return NextResponse.json({ 
        shouldSponsor: false,
        reason: 'Only Towns space contract is supported'
      });
    }

    // 3. Rate limiting - one join per user per day
    const lastJoin = recentJoins.get(userAddress.toLowerCase());
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    if (lastJoin && (now - lastJoin) < ONE_DAY) {
      console.log('❌ Rate limited:', userAddress);
      return NextResponse.json({ 
        shouldSponsor: false,
        reason: 'User already joined recently'
      });
    }

    // 4. All checks passed - sponsor the transaction
    recentJoins.set(userAddress.toLowerCase(), now);
    
    // Clean up old entries (keep last 1000)
    if (recentJoins.size > 1000) {
      const oldest = Array.from(recentJoins.entries())
        .sort((a, b) => a[1] - b[1])
        .slice(0, 500);
      oldest.forEach(([addr]) => recentJoins.delete(addr));
    }

    console.log('✅ Sponsorship approved for:', userAddress);
    
    return NextResponse.json({ 
      shouldSponsor: true,
      message: 'Sponsorship approved'
    });

  } catch (error: any) {
    console.error('❌ Verification error:', error);
    return NextResponse.json({ 
      shouldSponsor: false,
      reason: 'Verification failed'
    });
  }
}
