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

    // ✅ FIXED: Import ethers-v5 instead of ethers
    const { ethers } = await import('ethers-v5');
    const { JoinSpace, townsEnv } = await import('@towns-protocol/sdk');
    
    const botWallet = new ethers.Wallet(BOT_PRIVATE_KEY);
    const botAddress = botWallet.address;

    console.log(`   Bot Address: ${botAddress}`);

    // ✅ Connect wallet to Base with explicit chain config
    const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL;
    console.log(`   RPC URL configured: ${!!rpcUrl}`);

    if (!rpcUrl) {
      return NextResponse.json({ 
        error: 'NEXT_PUBLIC_BASE_RPC_URL not configured' 
      }, { status: 500 });
    }

    // ✅ Define Base network explicitly to avoid auto-detection
    const baseNetwork = {
      name: 'base',
      chainId: 8453,
    };

    const provider = new ethers.providers.StaticJsonRpcProvider(
      rpcUrl,
      baseNetwork
    );

    const connectedWallet = botWallet.connect(provider);

    // Check balance
    const balance = await provider.getBalance(botAddress);
    const balanceEth = ethers.utils.formatEther(balance);
    console.log(`   Balance: ${balanceEth} ETH`);
    
    if (balance.eq(0)) {
      return NextResponse.json({ 
        error: 'Bot wallet has no ETH for gas',
        botAddress,
      }, { status: 400 });
    }

    // Configure Towns
    const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega', {
      rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL,
    });

    console.log('🚀 Attempting to join space...');
    console.log('   Using server-side SDK (bypasses browser rate limits)');

    // Join the space - Towns SDK will handle membership minting
    const result = await JoinSpace({
      spaceId: SPACE_ID,
      signer: connectedWallet,
      townsConfig: TOWNS_CONFIG,
      skipMintMembership: false, // Let Towns SDK mint the NFT
    });

    console.log('✅ BOT JOINED SUCCESSFULLY!');
    console.log('   Result:', result);
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
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to join space',
      code: error.code,
      reason: error.reason,
    }, { status: 500 });
  }
}
