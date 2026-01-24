import { NextRequest, NextResponse } from "next/server";
import {
  getContract,
  prepareContractCall,
  Engine,
  readContract,
} from "thirdweb";
import { base } from "thirdweb/chains";
import { client, serverWallet, SERVER_WALLET_ADDRESS } from "@/thirdweb-server-wallet";

export const dynamic = "force-dynamic";

const MEMBERSHIP_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_KNEAD_SPACE_CONTRACT_ADDRESS;
const ALLOWED_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
const SPACE_TOKEN_ID = 464407n;
const MINT_GAS_LIMIT = 300000n;

// Simple in-memory rate limiting (use Redis/KV in production)
const mintAttempts = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const { userAddress, spaceId } = await req.json();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎫 Minting membership NFT');
    console.log(`   User: ${userAddress}`);
    console.log(`   Space: ${spaceId}`);

    // 🔒 Validation 1: Required fields
    if (!userAddress || !spaceId) {
      console.error('❌ Missing required fields');
      return NextResponse.json({ 
        error: 'Missing required fields: userAddress and spaceId are required.' 
      }, { status: 400 });
    }

    // 🔒 Validation 2: Only allow your space
    if (spaceId !== ALLOWED_SPACE_ID) {
      console.warn('⚠️ Invalid space ID attempt:', spaceId);
      return NextResponse.json({ 
        error: 'Invalid space ID' 
      }, { status: 400 });
    }

    // 🔒 Validation 3: IP rate limiting (basic)
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'unknown';
    const ipKey = `ip:${ip}`;
    const ipCount = mintAttempts.get(ipKey) || 0;
    
    if (ipCount >= 5) {
      console.warn('⚠️ Rate limit exceeded for IP:', ip);
      return NextResponse.json({ 
        error: 'Rate limit exceeded. Please try again later.' 
      }, { status: 429 });
    }
    
    mintAttempts.set(ipKey, ipCount + 1);
    setTimeout(() => mintAttempts.delete(ipKey), 60 * 60 * 1000);

    if (!MEMBERSHIP_CONTRACT_ADDRESS) {
      throw new Error("NEXT_PUBLIC_KNEAD_SPACE_CONTRACT_ADDRESS not configured");
    }

    console.log(`   Server Wallet: ${SERVER_WALLET_ADDRESS}`);
    console.log(`   Contract: ${MEMBERSHIP_CONTRACT_ADDRESS}`);

    const contract = getContract({
      client,
      address: MEMBERSHIP_CONTRACT_ADDRESS,
      chain: base,
    });

    // 🔒 Validation 4: Check if user already has NFT
    try {
      const userBalance = await readContract({
        contract,
        method: "function balanceOf(address account, uint256 id) view returns (uint256)",
        params: [userAddress, SPACE_TOKEN_ID],
      });

      console.log(`   Current Balance: ${userBalance.toString()}`);

      if (userBalance > 0n) {
        console.log('✅ User already has membership NFT');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return NextResponse.json({
          success: true,
          alreadyMinted: true,
          message: "User already has membership NFT",
        });
      }
    } catch (balanceError: any) {
      console.warn('⚠️ Could not check balance:', balanceError.message);
    }

    // Prepare mint transaction (same as Stripe webhook pattern)
    console.log('🔧 Preparing mint transaction...');
    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [userAddress, SPACE_TOKEN_ID, 1n],
      gasLimit: MINT_GAS_LIMIT,
    });

    // Enqueue transaction (same as Stripe webhook)
    console.log('🔧 Enqueueing transaction...');
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    console.log(`   Transaction ID: ${transactionId}`);

    // Wait for transaction hash (same as Stripe webhook)
    console.log('⏳ Waiting for transaction hash...');
    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    console.log(`✅ Membership NFT minted: ${transactionHash}`);
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
    console.error("❌ Error minting membership NFT:");
    console.error("   Message:", error.message);
    console.error("   Stack:", error.stack);
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
