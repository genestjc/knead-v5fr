import { NextRequest, NextResponse } from "next/server";
import {
  Engine,
  createThirdwebClient,
  getContract,
  prepareContractCall,
} from "thirdweb";
import { base } from "thirdweb/chains";

// Minimal ABI for createSpace and SpaceCreated event
const SPACE_FACTORY_ABI = [
  {
    inputs: [{ internalType: "string", name: "name", type: "string" }],
    name: "createSpace",
    outputs: [{ internalType: "uint256", name: "spaceId", type: "uint256" }],
    stateMutability: "nonpayable",
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
      { indexed: false, internalType: "string", name: "name", type: "string" },
    ],
    name: "SpaceCreated",
    type: "event",
  },
];

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Space name is required' },
        { status: 400 }
      );
    }

    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
      return NextResponse.json(
        { success: false, error: 'NEXT_PUBLIC_THIRDWEB_CLIENT_ID not configured' },
        { status: 500 }
      );
    }

    if (!process.env.ENGINE_SERVER_WALLET_ADDRESS) {
      return NextResponse.json(
        { success: false, error: 'ENGINE_SERVER_WALLET_ADDRESS not configured' },
        { status: 500 }
      );
    }

    if (!process.env.ENGINE_VAULT_ACCESS_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'ENGINE_VAULT_ACCESS_TOKEN not configured' },
        { status: 500 }
      );
    }

    console.log(`🚀 Creating Towns space: "${name}"`);

    // Initialize ThirdWeb client
    const client = createThirdwebClient({
      clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
    });

    // Initialize Engine server wallet
    const myServerWallet = Engine.serverWallet({
      client,
      address: process.env.ENGINE_SERVER_WALLET_ADDRESS,
      vaultAccessToken: process.env.ENGINE_VAULT_ACCESS_TOKEN,
    });

    console.log('Server wallet:', process.env.ENGINE_SERVER_WALLET_ADDRESS);

    // Get SpaceFactory contract
    const contract = getContract({
      client,
      chain: base,
      address: "0x9978c826d93883701522d2ca645d5436e5654252",
      abi: SPACE_FACTORY_ABI,
    });

    // Prepare the transaction
    const transaction = prepareContractCall({
      contract,
      method: "function createSpace(string name)",
      params: [name],
    });

    console.log('Enqueueing transaction via Engine...');

    // Send the transaction using Engine server wallet
    const { transactionId } = await myServerWallet.enqueueTransaction({
      transaction,
    });

    console.log('Transaction enqueued:', transactionId);
    console.log('Waiting for transaction hash...');

    // Wait for the transaction hash
    const { transactionHash, logs } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    console.log('Transaction confirmed:', transactionHash);

    // Find the SpaceCreated event in the logs
    const eventSignature = "SpaceCreated(uint256,address,string)";
    const spaceCreatedLog = logs.find(
      (log: any) =>
        log.eventName === "SpaceCreated" || log.eventSignature === eventSignature,
    );

    if (!spaceCreatedLog) {
      throw new Error('SpaceCreated event not found in transaction logs');
    }

    const spaceId = spaceCreatedLog?.args?.spaceId?.toString();

    if (!spaceId) {
      throw new Error('spaceId not found in SpaceCreated event');
    }

    console.log('✅ Space created successfully!');
    console.log('📋 Space ID:', spaceId);

    return NextResponse.json({
      success: true,
      transactionId,
      transactionHash,
      spaceId,
      defaultChannelId: spaceId, // Towns confirmed: default channel ID = space ID
      explorerUrl: `https://basescan.org/tx/${transactionHash}`,
      serverWallet: process.env.ENGINE_SERVER_WALLET_ADDRESS,
    });

  } catch (error: any) {
    console.error('❌ Error creating space:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to create space',
        details: error.reason || error.data?.message,
      },
      { status: 500 }
    );
  }
}
