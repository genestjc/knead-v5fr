
import { NextRequest, NextResponse } from "next/server";
import { Engine, prepareContractCall } from "thirdweb";
import { base } from "thirdweb/chains";
import { client, serverWallet } from "@/thirdweb-server-wallet";
import { getContract } from "thirdweb";

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
    console.log(`   To: ${toAddress}`);

    const contract = getContract({
      client,
      chain: base,
      address: SPACE_OWNER_CONTRACT_ADDRESS,
    });

    // Get current owner (should be server wallet)
    const currentOwnerAddress = await serverWallet.getAccount().address;

    // Prepare transfer transaction
    console.log('🔧 Preparing transfer...');
    const transaction = prepareContractCall({
      contract,
      method: "function safeTransferFrom(address from, address to, uint256 tokenId)",
      params: [currentOwnerAddress, toAddress, BigInt(tokenId)],
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
    console.error('❌ Error transferring ownership:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to transfer ownership' },
      { status: 500 }
    );
  }
}
