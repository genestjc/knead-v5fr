import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache to prevent duplicate sponsorships
const recentJoins = new Map<string, number>();

export const dynamic = 'force-dynamic';

/**
 * ThirdWeb Server Verifier Endpoint
 * 
 * Called by ThirdWeb paymaster to verify if a transaction should be sponsored.
 * 
 * Request format:
 * {
 *   "clientId": string,
 *   "chainId": number,
 *   "userOp": {
 *     "sender": string,
 *     "targets": string[],
 *     "gasLimit": string,
 *     "gasPrice": string,
 *     "data": { ... }
 *   }
 * }
 * 
 * Response format:
 * {
 *   "isAllowed": boolean,
 *   "reason"?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('🔍 Sponsorship verification request:', JSON.stringify(body, null, 2));

    const { clientId, chainId, userOp } = body;

    // Validate request has required fields
    if (!clientId || !chainId || !userOp) {
      console.log('❌ Missing required fields in request');
      return NextResponse.json({ 
        isAllowed: false,
        reason: 'Invalid request format'
      }, { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { sender, targets } = userOp;

    // 1. Verify correct chain (Base = 8453)
    if (chainId !== 8453) {
      console.log('❌ Wrong chain:', chainId);
      return NextResponse.json({ 
        isAllowed: false,
        reason: `Only Base chain (8453) is supported, got ${chainId}`
      }, { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Verify client ID matches your project
    const EXPECTED_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
    if (EXPECTED_CLIENT_ID && clientId !== EXPECTED_CLIENT_ID) {
      console.log('❌ Wrong client ID');
      return NextResponse.json({ 
        isAllowed: false,
        reason: 'Invalid client ID'
      }, { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Verify target contract (if targets are provided)
    const SPACE_CONTRACT = process.env.NEXT_PUBLIC_KNEAD_SPACE_CONTRACT_ADDRESS?.toLowerCase();
    if (targets && targets.length > 0 && SPACE_CONTRACT) {
      const targetContract = targets[0].toLowerCase();
      
      if (targetContract !== SPACE_CONTRACT) {
        console.log('❌ Wrong contract target');
        console.log('   Expected:', SPACE_CONTRACT);
        console.log('   Got:', targetContract);
        return NextResponse.json({ 
          isAllowed: false,
          reason: 'Contract not whitelisted'
        }, { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 4. Rate limiting - one transaction per sender per day
    if (sender) {
      const lastTransaction = recentJoins.get(sender.toLowerCase());
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;

      if (lastTransaction && (now - lastTransaction) < ONE_DAY) {
        console.log('⚠️ Rate limited:', sender);
        // For now, still allow but log it
        // Uncomment to enforce rate limiting:
        // return NextResponse.json({ 
        //   isAllowed: false,
        //   reason: 'Rate limit: one transaction per day'
        // }, { status: 200, headers: { 'Content-Type': 'application/json' } });
      } else {
        recentJoins.set(sender.toLowerCase(), now);
      }
    }

    // 5. All checks passed - approve sponsorship
    console.log('✅ Sponsorship approved');
    console.log('   Sender:', sender);
    console.log('   Chain:', chainId);
    console.log('   Targets:', targets);
    
    return NextResponse.json({ 
      isAllowed: true,
      reason: 'Transaction approved for sponsorship'
    }, { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Verification error:', error);
    console.error('   Error details:', error.message);
    
    // On error, deny sponsorship
    return NextResponse.json({ 
      isAllowed: false,
      reason: 'Server error during verification'
    }, { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle OPTIONS for CORS preflight
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
