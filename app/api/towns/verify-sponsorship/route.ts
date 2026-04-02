import { NextRequest, NextResponse } from 'next/server';

const SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID?.toLowerCase();
const MEMBERSHIP_CONTRACT = '0x616843f796b43e6ef972e7c345d2b06d85513543'; // Explicit address
const SPACE_CONTRACT = process.env.NEXT_PUBLIC_KNEAD_SPACE_CONTRACT_ADDRESS?.toLowerCase();

// Contracts we should sponsor gas for
const ALLOWED_CONTRACTS = [
  MEMBERSHIP_CONTRACT, // ✅ Membership NFT minting
  SPACE_CONTRACT,      // ✅ Space interactions
  // Add other contracts you want to sponsor
].filter(Boolean).map(addr => addr?.toLowerCase());

const MAX_GAS_PRICE = BigInt("50000000000"); // 50 gwei max

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, chainId, userOp } = body;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Gas Sponsorship Request');
    console.log('   Chain:', chainId);
    console.log('   Sender:', userOp.sender);
    console.log('   Gas Price:', userOp.gasPrice);
    
    const targets = userOp.data?.targets || [];
    const targetsList = targets.map((t: string) => t.toLowerCase());
    
    console.log('   Targets:', targetsList);
    console.log('   Allowed:', ALLOWED_CONTRACTS);

    // ✅ Validation 1: Only sponsor Base mainnet
    if (chainId !== 8453) {
      console.log('❌ Wrong chain:', chainId);
      return NextResponse.json({
        isAllowed: false,
        reason: 'Only Base mainnet (8453) is sponsored'
      });
    }

    // ✅ Validation 2: Check gas price isn't excessive
    const gasPrice = BigInt(userOp.gasPrice);
    if (gasPrice > MAX_GAS_PRICE) {
      console.log('❌ Gas price too high:', gasPrice);
      return NextResponse.json({
        isAllowed: false,
        reason: `Gas price ${gasPrice} exceeds max ${MAX_GAS_PRICE}`
      });
    }

    // ✅ Validation 3: Check contract is in allowlist
    const isAllowedContract = targetsList.some((target: string) => 
      ALLOWED_CONTRACTS.includes(target)
    );

    if (!isAllowedContract && targetsList.length > 0) {
      console.log('❌ Contract not in allowlist');
      console.log('   Requested:', targetsList);
      console.log('   Allowed:', ALLOWED_CONTRACTS);
      return NextResponse.json({
        isAllowed: false,
        reason: 'Contract not in allowlist'
      });
    }

    // ✅ All validations passed - sponsor the gas!
    console.log('✅ Gas sponsorship APPROVED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return NextResponse.json({
      isAllowed: true,
    });

  } catch (error: any) {
    console.error('❌ Sponsorship verification error:', error);
    return NextResponse.json({
      isAllowed: false,
      reason: `Server error: ${error.message}`
    }, { status: 500 });
  }
}
