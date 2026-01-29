import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BOT_PRIVATE_KEY = process.env.KNEAD_CHAT_BOT_PRIVATE_KEY;
const SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json();
    
    // Simple security check
    if (secret !== 'join-bot-now-123') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!BOT_PRIVATE_KEY || !SPACE_ID) {
      return NextResponse.json({ 
        error: 'Missing bot credentials in environment' 
      }, { status: 500 });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 MANUAL BOT JOIN - SERVER SIDE');
    console.log(`   Space ID: ${SPACE_ID}`);

    // Import ethers-v5 and Towns SDK
    const { ethers } = await import('ethers-v5');
    const { JoinSpace, townsEnv } = await import('@towns-protocol/sdk');
    
    const botWallet = new ethers.Wallet(BOT_PRIVATE_KEY);
    const botAddress = botWallet.address;
    
    console.log(`   Bot Address: ${botAddress}`);

    // Create provider for Towns SDK (don't call any methods on it to avoid fetch issues)
    const provider = new ethers.providers.StaticJsonRpcProvider(
      process.env.NEXT_PUBLIC_BASE_RPC_URL,
      { name: 'base', chainId: 8453 }
    );
    
    const connectedWallet = botWallet.connect(provider);

    // Configure Towns
    const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega', {
      rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL,
    });

    console.log('🚀 Attempting to join space...');
    console.log('   Skipping balance check to avoid serverless fetch issues');
    console.log('   Bot has ~0.002 ETH based on BaseScan');

    // Join the space - Towns SDK will handle membership minting
    const result = await JoinSpace({
      spaceId: SPACE_ID,
      signer: connectedWallet,
      townsConfig: TOWNS_CONFIG,
      skipMintMembership: false, // Let Towns SDK mint the NFT
    });

    console.log('✅ BOT JOINED SUCCESSFULLY!');
    console.log('   Result:', JSON.stringify(result, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json({
      success: true,
      botAddress,
      spaceId: SPACE_ID,
      result,
      message: 'Bot successfully joined the space!',
    });

  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Manual bot join failed:', error);
    console.error('   Message:', error.message);
    console.error('   Code:', error.code);
    console.error('   Reason:', error.reason);
    
    // Log full error for debugging
    try {
      console.error('   Full error:', JSON.stringify({
        message: error.message,
        code: error.code,
        reason: error.reason,
        stack: error.stack?.split('\n').slice(0, 5),
      }, null, 2));
    } catch {
      console.error('   Error object:', error);
    }
    
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to join space',
      code: error.code,
      reason: error.reason,
    }, { status: 500 });
  }
}
