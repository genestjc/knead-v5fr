// app/api/towns/fund-wallet/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Engine, prepareTransaction, getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { client, serverWallet, SERVER_WALLET_ADDRESS } from "@/thirdweb-server-wallet";

export const dynamic = "force-dynamic";

const GAS_AMOUNT_WEI = BigInt("100000000000000"); // 0.0001 ETH

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

    // ✅ Use ThirdWeb's RPC instead of ethers.js
    const { getRpcClient } = await import('thirdweb/rpc');
    const rpcClient = getRpcClient({ client, chain: base });

    // ✅ Check user balance using ThirdWeb
    const userBalanceHex = await rpcClient({
      method: 'eth_getBalance',
      params: [userAddress, 'latest'],
    });
    const userBalance = BigInt(userBalanceHex);

    console.log(`   Current balance: ${userBalance.toString()} wei (${(Number(userBalance) / 1e18).toFixed(6)} ETH)`);
    
    // If user already has enough ETH, skip funding
    if (userBalance >= GAS_AMOUNT_WEI) {
      console.log(`✅ Wallet already has sufficient balance`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return NextResponse.json({
        success: true,
        alreadyFunded: true,
        message: 'Wallet already has sufficient balance',
        currentBalance: (Number(userBalance) / 1e18).toFixed(6),
      });
    }

    console.log(`   Sending: 0.0001 ETH (~$0.30)`);

    // ✅ Check server wallet balance using ThirdWeb
    const serverBalanceHex = await rpcClient({
      method: 'eth_getBalance',
      params: [SERVER_WALLET_ADDRESS, 'latest'],
    });
    const serverBalance = BigInt(serverBalanceHex);
    
    console.log(`   Server balance: ${(Number(serverBalance) / 1e18).toFixed(6)} ETH`);
    
    if (serverBalance < GAS_AMOUNT_WEI) {
      console.error(`❌ Server wallet balance too low: ${(Number(serverBalance) / 1e18).toFixed(6)} ETH`);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return NextResponse.json({
        error: `Server wallet balance too low (${(Number(serverBalance) / 1e18).toFixed(6)} ETH). Please fund: ${SERVER_WALLET_ADDRESS}`,
        success: false,
      }, { status: 500 });
    }

    // ✅ Prepare ETH transfer transaction (same as Stripe webhook pattern)
    console.log('🔧 Preparing transaction...');
    const transaction = prepareTransaction({
      to: userAddress,
      value: GAS_AMOUNT_WEI,
      chain: base,
      client,
    });

    // ✅ Enqueue transaction with Engine (same as Stripe webhook)
    console.log('🔧 Enqueueing transfer...');
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    console.log(`   Transaction ID: ${transactionId}`);

    // ✅ Wait for transaction hash (same as Stripe webhook)
    console.log('⏳ Waiting for transaction hash...');
    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    console.log(`✅ Wallet funded successfully`);
    console.log(`   Transaction: ${transactionHash}`);
    console.log(`   Explorer: https://basescan.org/tx/${transactionHash}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json({
      success: true,
      transactionHash,
      amount: "0.0001",
      explorerUrl: `https://basescan.org/tx/${transactionHash}`,
      alreadyFunded: false,
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
