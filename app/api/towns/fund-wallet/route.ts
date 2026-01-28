import { NextRequest, NextResponse } from "next/server";
import { Engine, prepareTransaction } from "thirdweb";
import { base } from "thirdweb/chains";
import { client, serverWallet, SERVER_WALLET_ADDRESS } from "@/thirdweb-server-wallet";

export const dynamic = "force-dynamic";

const GAS_AMOUNT_WEI = BigInt("100000000000000"); // 0.0001 ETH

// ✅ Retry wrapper for RPC connection
async function getProviderWithRetry(rpcUrl: string, retries = 3) {
  const { ethers } = await import('ethers-v5');
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`   Attempt ${i + 1}/${retries} - Creating provider...`);
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      await provider.getNetwork(); // Test connection
      console.log(`   ✅ Provider connected successfully`);
      return provider;
    } catch (error: any) {
      console.error(`   ❌ Attempt ${i + 1} failed: ${error.message}`);
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
    }
  }
  throw new Error('Failed to create provider after retries');
}

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

    // ✅ Get RPC URL
    const rpcUrl = process.env.BASE_RPC_URL || 
                   process.env.NEXT_PUBLIC_BASE_RPC_URL || 
                   'https://mainnet.base.org';

    console.log(`   Using RPC: ${rpcUrl.substring(0, 60)}...`);

    // ✅ Create provider with retry
    const provider = await getProviderWithRetry(rpcUrl);
    
    const userBalance = await provider.getBalance(userAddress);
    const { ethers } = await import('ethers-v5');
    const userBalanceEth = ethers.utils.formatEther(userBalance);
    
    console.log(`   Current balance: ${userBalanceEth} ETH`);
    
    // If user already has enough ETH, skip funding
    if (userBalance.gte(GAS_AMOUNT_WEI)) {
      console.log(`✅ Wallet already has sufficient balance`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return NextResponse.json({
        success: true,
        alreadyFunded: true,
        message: 'Wallet already has sufficient balance',
        currentBalance: userBalanceEth,
      });
    }

    console.log(`   Sending: 0.0001 ETH (~$0.30)`);

    // Check server wallet balance
    const serverBalance = await provider.getBalance(SERVER_WALLET_ADDRESS);
    const serverBalanceEth = ethers.utils.formatEther(serverBalance);
    console.log(`   Server balance: ${serverBalanceEth} ETH`);
    
    if (serverBalance.lt(GAS_AMOUNT_WEI)) {
      console.error(`❌ Server wallet balance too low: ${serverBalanceEth} ETH`);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return NextResponse.json({
        error: `Server wallet balance too low (${serverBalanceEth} ETH). Please fund: ${SERVER_WALLET_ADDRESS}`,
        success: false,
      }, { status: 500 });
    }

    // Prepare ETH transfer transaction
    console.log('🔧 Preparing transaction...');
    const transaction = prepareTransaction({
      to: userAddress,
      value: GAS_AMOUNT_WEI,
      chain: base,
      client,
    });

    // Enqueue transaction with Engine
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
