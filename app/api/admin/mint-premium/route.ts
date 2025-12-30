import { NextRequest, NextResponse } from "next/server";
import { getContract, prepareContractCall, Engine } from "thirdweb";
import { base } from "thirdweb/chains";
import { client, serverWallet, SERVER_WALLET_ADDRESS } from "../../../../thirdweb-server-wallet";
import kneadMembershipABI from "../../../abi/kneadMembershipABI.json";

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
      console.error("ADMIN_SECRET_KEY environment variable not set");
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
    console.log("Server wallet address:", SERVER_WALLET_ADDRESS);
    console.log("Contract address:", CONTRACT_ADDRESS);
    
    // Get contract
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });
    
    // Prepare mint transaction
    console.log(`Preparing to mint premium NFT to ${wallet_address}`);
    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [wallet_address, BigInt(1), 1n],
      gasLimit: 300000n,
    });
    
    // Send transaction using Engine
    console.log("Sending mint transaction...");
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });
    
    console.log("Mint transaction sent:", transactionHash);
    
    return NextResponse.json({
      success: true,
      transactionHash,
      transactionId,
      message: `Premium membership minted to ${wallet_address}`
    });
  } catch (error: any) {
    console.error("Error in manual mint:", error);
    
    // Don't leak stack traces in production
    const errorResponse = process.env.NODE_ENV === 'production'
      ? { error: "Internal server error" }
      : { error: error.message, stack: error.stack };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
