import { NextRequest, NextResponse } from "next/server";
import { Engine, getContract, prepareContractCall } from "thirdweb";
import { base } from "thirdweb/chains";
import { client, serverWallet } from "@/thirdweb-server-wallet";

export const dynamic = "force-dynamic";

const BOT_ADDRESS = "0x57F36b4412b44Be0b7BfA22cDB584f63202821B3";
const SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;

// Towns Space contract address (the membership NFT contract)
const SPACE_CONTRACT = "0xYOUR_SPACE_CONTRACT_ADDRESS"; // We need to find this

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json();
    
    if (secret !== 'join-bot-now-123') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!SPACE_ID) {
      return NextResponse.json({ 
        error: 'Missing space ID in environment' 
      }, { status: 500 });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 MANUAL BOT JOIN - USING ENGINE');
    console.log(`   Bot Address: ${BOT_ADDRESS}`);
    console.log(`   Space ID: ${SPACE_ID}`);

    // Get the space membership contract
    const contract = getContract({
      client,
      chain: base,
      address: SPACE_CONTRACT,
    });

    // Prepare join transaction (mint membership NFT)
    // This might be "join" or "mint" depending on the contract
    const transaction = prepareContractCall({
      contract,
      method: "function join(uint256 spaceId)", // Adjust based on actual contract
      params: [BigInt(SPACE_ID)],
    });

    console.log('🚀 Enqueueing join transaction via Engine...');

    // Send via server wallet (which has funds)
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    console.log(`   Transaction ID: ${transactionId}`);
    console.log('⏳ Waiting for confirmation...');

    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    console.log('✅ BOT JOINED SUCCESSFULLY!');
    console.log(`   Transaction: ${transactionHash}`);
    console.log(`   Explorer: https://basescan.org/tx/${transactionHash}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json({
      success: true,
      botAddress: BOT_ADDRESS,
      spaceId: SPACE_ID,
      transactionHash,
      explorerUrl: `https://basescan.org/tx/${transactionHash}`,
      message: 'Bot successfully joined the space!',
    });

  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Manual bot join failed:', error);
    console.error('   Message:', error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to join space',
    }, { status: 500 });
  }
}
