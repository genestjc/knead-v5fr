import { NextRequest, NextResponse } from "next/server";
import { getContract, prepareContractCall, Engine } from "thirdweb";
import { base } from "thirdweb/chains";
import { client, serverWallet, SERVER_WALLET_ADDRESS } from "../../../../thirdweb-server-wallet";
import kneadMembershipABI from "../../../abi/kneadMembershipABI.json";
import { logger } from "@/lib/logger";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as string;

export async function POST(req: NextRequest) {
  try {
    // Verify admin secret via Authorization header
    const authHeader = req.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;
    if (!ADMIN_SECRET) {
      logger.error("ADMIN_SECRET_KEY environment variable not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    
    if (token !== ADMIN_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid credentials" },
        { status: 401 }
      );
    }
    
    const { wallet_address } = await req.json();
    
    if (!wallet_address) {
      return NextResponse.json(
        { error: "Missing wallet_address" },
        { status: 400 }
      );
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return NextResponse.json(
        { error: "Invalid Ethereum address format" },
        { status: 400 }
      );
    }
    
    // Log server wallet info
    logger.log("Server wallet address:", SERVER_WALLET_ADDRESS);
    logger.log("Contract address:", CONTRACT_ADDRESS);
    
    // Get contract
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });
    
    // Prepare mint transaction
    logger.log(`Preparing to mint premium NFT to ${wallet_address}`);
    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [wallet_address, BigInt(1), 1n],
      gasLimit: 300000n,
    });
    
    // Send transaction using Engine
    logger.log("Sending mint transaction...");
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });
    
    logger.log("Mint transaction sent:", transactionHash);
    
    return NextResponse.json({
      success: true,
      transactionHash,
      transactionId,
      message: `Premium membership minted to ${wallet_address}`
    });
  } catch (error: any) {
    logger.error("Error in manual mint:", error);
    
    // Generic error message - don't leak implementation details
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
