import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_CONTRACTS = [
  process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID?.toLowerCase(),
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
      return NextResponse.json({
        isAllowed: false,
        reason: 'Contract not in allowlist'
      });
    }

    // Validation 4: Rate limiting (optional)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Check daily transaction count
      const { count } = await supabase
        .from('sponsored_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_address', userOp.sender.toLowerCase())
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (count && count >= MAX_DAILY_TRANSACTIONS_PER_USER) {
        return NextResponse.json({
          isAllowed: false,
          reason: 'Daily transaction limit exceeded'
        });
      }

      // Log the sponsored transaction
      await supabase.from('sponsored_transactions').insert({
        user_address: userOp.sender.toLowerCase(),
        chain_id: chainId,
        gas_price: userOp.gasPrice,
        targets: targets,
        approved: true,
      });
    }

    console.log('✅ Sponsorship approved');
    return NextResponse.json({
      isAllowed: true,
      reason: 'Valid Towns chat transaction'
    });

  } catch (error: any) {
    console.error('❌ Sponsorship verification error:', error);
    
    // Fail open or closed? For production, fail closed:
    return NextResponse.json({
      isAllowed: false,
      reason: `Verification error: ${error.message}`
    });
  }
}
