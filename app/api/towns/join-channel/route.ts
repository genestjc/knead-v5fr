import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers-v5';

const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL!;

export async function POST(req: NextRequest) {
  try {
    const { channelId, botPrivateKey } = await req.json();
    
    if (!channelId || !botPrivateKey) {
      return NextResponse.json(
        { error: 'Missing channelId or botPrivateKey' },
        { status: 400 }
      );
    }
    
    console.log('🤖 Bot joining channel:', channelId.substring(0, 16) + '...');
    
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const botWallet = new ethers.Wallet(botPrivateKey, provider);
    
    console.log('   Bot address:', botWallet.address);
    
    // Use Towns SDK to join channel
    const { townsEnv } = await import('@towns-protocol/sdk');
    const townsConfig = townsEnv().makeTownsConfig('omega', { rpcUrl: RPC_URL });
    
    // Join the channel through the River protocol
    const { makeStreamRpcClient } = await import('@river-build/sdk');
    
    const streamClient = makeStreamRpcClient({
      rpcUrls: [townsConfig.riverConfig.rpcUrl],
    });
    
    await streamClient.joinStream({
      streamId: channelId,
      wallet: botWallet,
    });
    
    console.log('✅ Bot successfully joined channel!');
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('❌ Join channel error:', error.message);
    
    // Treat "already joined" as success
    if (error.message?.includes('already') || 
        error.message?.includes('member') ||
        error.message?.includes('joined')) {
      console.log('✅ Bot already in channel');
      return NextResponse.json({ success: true, alreadyMember: true });
    }
    
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
