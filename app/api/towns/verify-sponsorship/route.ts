import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_CONTRACTS = [
  process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID?.toLowerCase(),
  process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS?.toLowerCase(), // ✅ ADD THIS
  // Add other Towns contract addresses
];

const MAX_GAS_PRICE = BigInt("50000000000"); // 50 gwei max
const MAX_DAILY_TRANSACTIONS_PER_USER = 100;

export async function POST(req: NextRequest) {
  try {
    // Verify request is from ThirdWeb
    const referer = req.headers.get('referer');
    if (!referer?.includes('thirdweb.com')) {
      return NextResponse.json(
        { isAllowed: false, reason: 'Invalid referer' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { clientId, chainId, userOp } = body;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Gas Sponsorship Request');
    console.log('   Client:', clientId);
    console.log('   Chain:', chainId);
    console.log('   Sender:', userOp.sender);
    console.log('   Targets:', userOp.data?.targets);
    console.log('   Gas Price:', userOp.gasPrice);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Validation 1: Only sponsor Base mainnet
    if (chainId !== 8453) {
      return NextResponse.json({
        isAllowed: false,
        reason: 'Only Base mainnet is sponsored'
      });
    }

    // Validation 2: Check gas price isn't excessive
    const gasPrice = BigInt(userOp.gasPrice);
    if (gasPrice > MAX_GAS_PRICE) {
      return NextResponse.json({
        isAllowed: false,
        reason: `Gas price too high: ${gasPrice} > ${MAX_GAS_PRICE}`
      });
    }

    // Validation 3: Check contract is allowed
    const targets = userOp.data?.targets || [];
    const isAllowedContract = targets.some((target: string) => 
      ALLOWED_CONTRACTS.includes(target.toLowerCase())
    );

    if (!isAllowedContract && targets.length > 0) {
      console.log('❌ Contract not in allowlist');
      console.log('   Targets:', targets);
      console.log('   Allowed:', ALLOWED_CONTRACTS);
      return NextResponse.json({
        isAllowed: false,
        reason: 'Contract not in allowlist'
      });
    }

    // ✅ All validations passed - sponsor the gas!
    console.log('✅ Gas sponsorship approved');
    return NextResponse.json({
      isAllowed: true,
    });

  } catch (error) {
    console.error('❌ Error in verify-sponsorship:', error);
    return NextResponse.json({
      isAllowed: false,
      reason: 'Server error'
    }, { status: 500 });
  }
}
