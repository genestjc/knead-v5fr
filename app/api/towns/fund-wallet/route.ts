import { NextRequest, NextResponse } from "next/server";
import { Engine } from "thirdweb";
import { base } from "thirdweb/chains";
import { client, serverWallet, SERVER_WALLET_ADDRESS } from "@/thirdweb-server-wallet";

export const dynamic = "force-dynamic";

// Amount to send for gas (0.005 ETH ≈ $0.01-0.02 on Base)
const GAS_AMOUNT_WEI = "5000000000000000"; // 0.005 ETH in wei

// Track funded addresses to prevent abuse (one funding per address per day)
const fundedAddresses = new Map<string, number>();
const ONE_DAY = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { userAddress } = await req.json();

    if (!userAddress) {
      return NextResponse.json({ 
        error: 'Missing userAddress' 
      }, { status: 400 });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 Funding wallet with gas');
    console.log(`   User: ${userAddress}`);
    console.log(`   Server: ${SERVER_WALLET_ADDRESS}`);

    // 🔒 Rate limiting: one funding per address per day
    const lastFunded = fundedAddresses.get(userAddress.toLowerCase());
    if (lastFunded && (Date.now() - lastFunded) < ONE_DAY) {
      const hoursAgo = Math.floor((Date.now() - lastFunded) / (1000 * 60 * 60));
      console.log(`✅ Wallet was funded ${hoursAgo} hours ago`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return NextResponse.json({
        success: true,
        alreadyFunded: true,
        message: `Wallet already funded ${hoursAgo} hours ago`,
      });
    }

    console.log(`   Sending: 0.005 ETH`);

    // Prepare ETH transfer transaction for Engine queue
    const transaction = {
      chain: base,
      client,
      to: userAddress,
      value: BigInt(GAS_AMOUNT_WEI),
    };

    // Enqueue transaction with Engine (same pattern as NFT minting)
    console.log('🔧 Enqueueing transfer...');
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    console.log(`   Transaction ID: ${transactionId}`);

    // Wait for transaction hash
    console.log('⏳ Waiting for transaction hash...');
    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    // Mark as funded (prevent duplicate funding for 24 hours)
    fundedAddresses.set(userAddress.toLowerCase(), Date.now());

    console.log(`✅ Wallet funded successfully`);
    console.log(`   Transaction: ${transactionHash}`);
    console.log(`   Explorer: https://basescan.org/tx/${transactionHash}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json({
      success: true,
      transactionHash,
      amount: "0.005",
      explorerUrl: `https://basescan.org/tx/${transactionHash}`,
    });

  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Error funding wallet:', error);
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return NextResponse.json(
      { 
        error: error.message || "Failed to fund wallet", 
        success: false 
      },
      { status: 500 },
    );
  }
}
