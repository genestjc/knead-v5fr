import { NextRequest, NextResponse } from "next/server";
import {
  Engine,
  getContract,
  prepareContractCall,
} from "thirdweb";
import { base } from "thirdweb/chains";
import {
  translateContractError,
  waitWithTimeout,
  SPACE_FACTORY_ADDRESS,
  DEFAULT_TRANSACTION_TIMEOUT_MS,
} from "@/lib/towns/space-utils";
import { client, serverWallet } from "../../../thirdweb-server-wallet";

// Type definition for transaction log entries
interface TransactionLog {
  eventName?:  string;
  eventSignature?: string;
  args?: {
    spaceId?: bigint | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Minimal ABI for createSpace and SpaceCreated event
const SPACE_FACTORY_ABI = [
  {
    inputs: [{ internalType: "string", name:  "name", type: "string" }],
    name: "createSpace",
    outputs: [{ internalType: "uint256", name: "spaceId", type: "uint256" }],
    stateMutability:  "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "spaceId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      { indexed: false, internalType:  "string", name: "name", type: "string" },
    ],
    name: "SpaceCreated",
    type: "event",
  },
];

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { name } = await req.json();

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Space name is required' },
        { status: 400 }
      );
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🚀 Creating Towns space:  "${name}"`);
    console.log(`📊 Request details:`)
    console.log(`   - Space name: ${name}`);
    console.log(`   - Timestamp: ${new Date().toISOString()}`);
    console.log(`   - Server wallet:  ${process.env.ENGINE_SERVER_WALLET_ADDRESS}`);
    
    console.log('\n🔍 Initializing blockchain connection...');

    // Get SpaceFactory contract
    const contract = getContract({
      client,
      chain: base,
      address:  SPACE_FACTORY_ADDRESS,
      abi: SPACE_FACTORY_ABI,
    });
    console.log(`✅ Contract initialized:  ${SPACE_FACTORY_ADDRESS}`);

    // Prepare the transaction
    console.log('\n🔍 Preparing transaction...');
    const transaction = prepareContractCall({
      contract,
      method: "function createSpace(string name)",
      params: [name],
    });
    console.log('✅ Transaction prepared');

    console.log('\n🔍 Enqueueing transaction via Engine...');
    const enqueueStartTime = Date.now();
    
    // Send the transaction using Engine server wallet (imported from thirdweb-server-wallet. ts)
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    const enqueueTime = Date.now() - enqueueStartTime;
    console. log(`✅ Transaction enqueued:  ${transactionId}`);
    console.log(`   - Enqueue time: ${enqueueTime}ms`);

    console.log('\n🔍 Waiting for transaction hash...');
    console.log(`   - Transaction ID: ${transactionId}`);
    console.log(`   - Timeout: ${DEFAULT_TRANSACTION_TIMEOUT_MS / 1000} seconds`);
    const waitStartTime = Date.now();

    // Wait for the transaction hash with timeout
    const { transactionHash, logs } = await waitWithTimeout(
      () => Engine.waitForTransactionHash({
        client,
        transactionId,
      }),
      DEFAULT_TRANSACTION_TIMEOUT_MS
    );

    const waitTime = Date.now() - waitStartTime;
    console.log(`✅ Transaction confirmed: ${transactionHash}`);
    console.log(`   - Wait time: ${waitTime}ms`);

    // Find the SpaceCreated event in the logs
    console.log('\n🔍 Parsing transaction logs...');
    console.log(`   - Total logs: ${logs?. length || 0}`);
    
    const eventSignature = "SpaceCreated(uint256,address,string)";
    const spaceCreatedLog = (logs as TransactionLog[]).find(
      (log) =>
        log.eventName === "SpaceCreated" || log.eventSignature === eventSignature,
    );

    if (!spaceCreatedLog) {
      console.error('❌ SpaceCreated event not found in transaction logs');
      console.error('Available logs:', JSON.stringify(logs, null, 2));
      throw new Error('SpaceCreated event not found in transaction logs');
    }

    const spaceId = spaceCreatedLog?. args?.spaceId?. toString();

    if (!spaceId) {
      console.error('❌ spaceId not found in SpaceCreated event');
      console.error('Event data:', JSON.stringify(spaceCreatedLog, null, 2));
      throw new Error('spaceId not found in SpaceCreated event');
    }

    const totalTime = Date.now() - startTime;
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Space created successfully!');
    console.log('📋 Summary:');
    console.log(`   - Space name: ${name}`);
    console.log(`   - Space ID: ${spaceId}`);
    console.log(`   - Transaction:  ${transactionHash}`);
    console.log(`   - Total time: ${totalTime}ms`);
    console.log(`   - Explorer: https://basescan.org/tx/${transactionHash}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse. json({
      success: true,
      transactionId,
      transactionHash,
      spaceId,
      defaultChannelId: spaceId, // Towns confirmed:  default channel ID = space ID
      explorerUrl: `https://basescan.org/tx/${transactionHash}`,
      serverWallet: process.env.ENGINE_SERVER_WALLET_ADDRESS,
      processingTime: totalTime,
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error:  any) {
    const totalTime = Date.now() - startTime;
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Error creating space');
    console.error('Error details: ');
    console.error(`   - Message: ${error.message || 'Unknown error'}`);
    console.error(`   - Type: ${error.constructor.name}`);
    console.error(`   - Time elapsed: ${totalTime}ms`);
    
    if (error.reason) {
      console.error(`   - Reason: ${error. reason}`);
    }
    if (error.code) {
      console.error(`   - Code: ${error.code}`);
    }
    if (error.data) {
      console.error(`   - Data: ${JSON.stringify(error.data)}`);
    }
    
    console.error('Full error:', error);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Translate error to user-friendly message
    const userFriendlyError = translateContractError(error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: userFriendlyError,
        details: {
          originalError: error. message || 'Failed to create space',
          reason: error.reason,
          code: error.code,
          processingTime: totalTime,
        },
      },
      { status:  500 }
    );
  }
}
