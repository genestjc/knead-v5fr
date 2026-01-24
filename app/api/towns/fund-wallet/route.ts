import { NextRequest, NextResponse } from "next/server";
import { prepareTransaction, toWei, sendTransaction, getNativeBalance } from "thirdweb";
import { base } from "thirdweb/chains";
import { client, serverWallet } from "@/thirdweb-server-wallet";

export const dynamic = "force-dynamic";

// Amount to send for gas (0.005 ETH ≈ $0.01-0.02 on Base)
const GAS_AMOUNT = "0.005";

// Minimum balance needed (if user already has this much, don't send more)
const MIN_BALANCE = "0.003";

// Track funded addresses to prevent abuse
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
    console.log('💰 Checking if wallet needs gas');
    console.log(`   Address: ${userAddress}`);

    // 🔒 Rate limiting: one funding per address per day
    const lastFunded = fundedAddresses.get(userAddress.toLowerCase());
    if (lastFunded && (Date.now() - lastFunded) < ONE_DAY) {
      console.log('✅ Wallet was funded recently');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return NextResponse.json({
        success: true,
        alreadyFunded: true,
        message: "Wallet already funded recently",
      });
    }

    // Check user's current balance
    const balance = await getNativeBalance({
      client,
      chain: base,
      address: userAddress,
    });

    const balanceInEth = Number(balance.displayValue);
    console.log(`   Current balance: ${balanceInEth} ETH`);

    // If user already has enough gas, skip funding
    if (balanceInEth >= Number(MIN_BALANCE)) {
      console.log('✅ Wallet has sufficient balance');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return NextResponse.json({
        success: true,
        alreadyFunded: true,
        message: "Wallet has sufficient balance",
        currentBalance: balanceInEth,
      });
    }

    console.log(`   Sending: ${GAS_AMOUNT} ETH`);

    // Send ETH from server wallet to user
    const transaction = prepareTransaction({
      to: userAddress,
      value: toWei(GAS_AMOUNT),
      chain: base,
      client,
    });

    const result = await sendTransaction({
      transaction,
      account: serverWallet,
    });

    // Wait for transaction to be mined
    const receipt = await result.wait();

    // Mark as funded
    fundedAddresses.set(userAddress.toLowerCase(), Date.now());

    console.log(`✅ Wallet funded successfully`);
    console.log(`   Transaction: ${receipt.transactionHash}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json({
      success: true,
      transactionHash: receipt.transactionHash,
      amount: GAS_AMOUNT,
      explorerUrl: `https://basescan.org/tx/${receipt.transactionHash}`,
    });

  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Error funding wallet:', error);
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
