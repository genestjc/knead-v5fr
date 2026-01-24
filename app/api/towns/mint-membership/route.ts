import { NextRequest, NextResponse } from "next/server";
import {
  getContract,
  prepareContractCall,
  Engine,
  readContract,
} from "thirdweb";
import { base } from "thirdweb/chains";
import { client, serverWallet } from "../../../../thirdweb-server-wallet";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_KNEAD_SPACE_CONTRACT_ADDRESS;

export async function POST(req: NextRequest) {
  try {
    if (!CONTRACT_ADDRESS) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_KNEAD_SPACE_CONTRACT_ADDRESS not configured" },
        { status: 500 },
      );
    }

    const { userAddress, spaceId } = await req.json();

    if (!userAddress) {
      return NextResponse.json(
        { error: "Missing userAddress" },
        { status: 400 },
      );
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 },
      );
    }

    const contract = getContract({
      client,
      chain: base,
      address: CONTRACT_ADDRESS,
    });

    // Check if user already has membership
    // Try to read balanceOf for the membership token
    try {
      const balance = await readContract({
        contract,
        method: "function balanceOf(address account, uint256 id) view returns (uint256)",
        params: [userAddress, 464407n], // Token ID from problem statement
      });

      if (balance > 0n) {
        console.log(`✅ User ${userAddress} already has membership (balance: ${balance})`);
        return NextResponse.json({
          success: true,
          alreadyHasMembership: true,
          message: "User already has membership",
        });
      }
    } catch (error) {
      // If balance check fails, continue with minting (might be different contract structure)
      console.log("Could not check balance, proceeding with mint:", error);
    }

    console.log(`🎫 Minting membership NFT for ${userAddress}...`);

    // Prepare mint transaction
    // Starting with safeMint(address) as suggested in problem statement
    const transaction = prepareContractCall({
      contract,
      method: "function safeMint(address to)",
      params: [userAddress],
      gasLimit: 300000n,
    });

    // Enqueue transaction with server wallet
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    // Wait for transaction hash
    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    console.log(`✅ Membership minted successfully: ${transactionHash}`);

    return NextResponse.json({
      success: true,
      transactionHash,
      transactionId,
      message: "Membership minted successfully",
    });
  } catch (error: any) {
    console.error("Membership mint error:", error);

    // Handle "already minted" errors gracefully
    if (
      error.message?.includes("already") ||
      error.message?.includes("exists") ||
      error.message?.includes("owned")
    ) {
      return NextResponse.json({
        success: true,
        alreadyHasMembership: true,
        message: "User already has membership",
      });
    }

    return NextResponse.json(
      { 
        error: "Failed to mint membership token",
        details: error.message 
      },
      { status: 500 },
    );
  }
}
