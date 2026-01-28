// app/api/space-owner/transfer/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Engine, prepareContractCall, getContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { client, serverWallet, SERVER_WALLET_ADDRESS } from "@/thirdweb-server-wallet";

const SPACE_OWNER_CONTRACT_ADDRESS = '0x2824D1235d1CbcA6d61C00C3ceeCB9155cd33a42';

export async function POST(req: NextRequest) {
  try {
    const { tokenId, toAddress } = await req.json();

    if (!tokenId || !toAddress) {
      return NextResponse.json({ 
        error: 'Missing tokenId or toAddress' 
      }, { status: 400 });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 Transferring Space Owner NFT');
    console.log(`   Token ID: ${tokenId}`);
    console.log(`   From: ${SERVER_WALLET_ADDRESS}`);
    console.log(`   To: ${toAddress}`);

    const contract = getContract({
      client,
      chain: base,
      address: SPACE_OWNER_CONTRACT_ADDRESS,
    });

    // Prepare transfer transaction
    console.log('🔧 Preparing transfer...');
    const transaction = prepareContractCall({
      contract,
      method: "function safeTransferFrom(address from, address to, uint256 tokenId)",
      params: [SERVER_WALLET_ADDRESS, toAddress, BigInt(tokenId)],
    });

    // Enqueue transaction with Engine
    console.log('🔧 Enqueueing transfer...');
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    console.log(`   Transaction ID: ${transactionId}`);

    // Wait for transaction hash
    console.log('⏳ Waiting for transaction...');
    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    console.log(`✅ Transfer successful`);
    console.log(`   Transaction: ${transactionHash}`);
    console.log(`   Explorer: https://basescan.org/tx/${transactionHash}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json({
      success: true,
      transactionHash,
      explorerUrl: `https://basescan.org/tx/${transactionHash}`,
      newOwner: toAddress,
    });

  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Error transferring ownership:', error);
    console.error('   Message:', error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return NextResponse.json(
      { error: error.message || 'Failed to transfer ownership' },
      { status: 500 }
    );
  }
}
