import { NextRequest, NextResponse } from "next/server";
import { getContract, prepareContractCall, Engine } from "thirdweb";
import { base } from "thirdweb/chains";
import { client, serverWallet, SERVER_WALLET_ADDRESS } from "../../../../thirdweb-server-wallet";
import kneadMembershipABI from "../../../abi/kneadMembershipABI.json";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as string;
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || "your-temporary-secret";

export async function POST(req: NextRequest) {
  try {
    // Basic auth
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    
    if (key !== ADMIN_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
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
    return NextResponse.json(
      { 
        error: error.message,
        stack: error.stack 
      },
      { status: 500 }
    );
  }
}
