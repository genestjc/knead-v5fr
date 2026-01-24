import { NextRequest, NextResponse } from "next/server";
import {
  getContract,
  prepareContractCall,
  Engine,
  readContract,
} from "thirdweb";
import { base } from "thirdweb/chains";
import {
  client,
  serverWallet,
} from "@/thirdweb-server-wallet";

export const dynamic = "force-dynamic";

// Towns space membership contract address
const MEMBERSHIP_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_KNEAD_SPACE_CONTRACT_ADDRESS;
const SPACE_TOKEN_ID = 464407n; // Token ID from space data

/**
 * POST /api/towns/mint-membership
 * 
 * Mints a Towns space membership NFT to a user's address.
 * Server wallet pays gas fees for the transaction.
 * 
 * Used to enable gasless space joining - server pre-mints the NFT,
 * then user can join with skipMintMembership: true (no gas required).
 */
export async function POST(req: NextRequest) {
  try {
    const { userAddress, spaceId } = await req.json();

    // Validate inputs
    if (!userAddress || !spaceId) {
      return NextResponse.json({ 
        error: 'Missing required fields: userAddress and spaceId are required.' 
      }, { status: 400 });
    }

    if (!MEMBERSHIP_CONTRACT_ADDRESS) {
      throw new Error(
        "NEXT_PUBLIC_KNEAD_SPACE_CONTRACT_ADDRESS not configured",
      );
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎫 Minting membership NFT for gasless join');
    console.log(`   - User: ${userAddress}`);
    console.log(`   - Space ID: ${spaceId}`);
    console.log(`   - Contract: ${MEMBERSHIP_CONTRACT_ADDRESS}`);
    console.log(`   - Token ID: ${SPACE_TOKEN_ID}`);

    // Get the contract
    const contract = getContract({
      client,
      address: MEMBERSHIP_CONTRACT_ADDRESS,
      chain: base,
    });

    // Check if user already has the membership NFT
    console.log('\n🔍 Checking if user already has membership...');
    try {
      const balance = await readContract({
        contract,
        method: "function balanceOf(address account, uint256 id) view returns (uint256)",
        params: [userAddress, SPACE_TOKEN_ID],
      });

      if (balance > 0n) {
        console.log('✅ User already has membership NFT');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return NextResponse.json({
          success: true,
          alreadyMinted: true,
          message: "User already has membership NFT",
        });
      }
    } catch (balanceError) {
      console.log('⚠️  Could not check balance, proceeding with mint:', balanceError);
    }

    // Prepare mint transaction
    console.log('\n🔍 Preparing mint transaction...');
    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [userAddress, SPACE_TOKEN_ID, 1n],
      gasLimit: 300000n,
    });

    console.log('\n🔍 Enqueueing transaction via Engine...');
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    console.log(`✅ Transaction enqueued: ${transactionId}`);
    console.log('\n🔍 Waiting for transaction hash...');

    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    console.log('✅ Membership NFT minted successfully!');
    console.log(`   - Transaction: ${transactionHash}`);
    console.log(`   - Explorer: https://basescan.org/tx/${transactionHash}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json({
      success: true,
      transactionHash,
      transactionId,
      message: "Membership NFT minted successfully",
      explorerUrl: `https://basescan.org/tx/${transactionHash}`,
    });

  } catch (error: any) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error("❌ Error minting membership NFT:", error);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return NextResponse.json(
      {
        error: error.message || "Failed to mint membership NFT",
        success: false,
      },
      { status: 500 },
    );
  }
}
