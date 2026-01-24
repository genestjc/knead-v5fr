import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache to prevent duplicate sponsorships
const recentJoins = new Map<string, number>();

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('🔍 Sponsorship verification request:', JSON.stringify(body, null, 2));

    const { userAddress, contractAddress, chainId } = body;

    // 1. Verify correct chain (Base = 8453)
    if (chainId && chainId !== 8453) {
      console.log('❌ Wrong chain:', chainId);
      return NextResponse.json({ 
        result: false // 🆕 Changed to "result"
      }, { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        }
      });
    }

    // 2. Verify correct contract (if provided)
    const SPACE_CONTRACT = process.env.NEXT_PUBLIC_KNEAD_SPACE_CONTRACT_ADDRESS?.toLowerCase();
    if (contractAddress && SPACE_CONTRACT && contractAddress.toLowerCase() !== SPACE_CONTRACT) {
      console.log('❌ Wrong contract:', contractAddress);
      console.log('   Expected:', SPACE_CONTRACT);
      console.log('   Got:', contractAddress.toLowerCase());
      return NextResponse.json({ 
        result: false
      }, { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        }
      });
    }

    // 3. Rate limiting - one join per user per day
    if (userAddress) {
      const lastJoin = recentJoins.get(userAddress.toLowerCase());
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;

      if (lastJoin && (now - lastJoin) < ONE_DAY) {
        console.log('⚠️ Rate limited:', userAddress);
        // Still allow for now, just log it
      } else {
        recentJoins.set(userAddress.toLowerCase(), now);
      }
    }

    console.log('✅ Sponsorship approved');
    console.log('   Returning: { result: true }');
    
    return NextResponse.json({ 
      result: true // 🆕 Changed to "result"
    }, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });

  } catch (error: any) {
    console.error('❌ Verification error:', error);
    console.error('   Error details:', error.message);
    
    return NextResponse.json({ 
      result: false
    }, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }
}

// 🆕 Handle OPTIONS for CORS preflight
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
