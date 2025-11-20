import { NextRequest, NextResponse } from 'next/server';
import { createThirdwebClient, Engine } from 'thirdweb';
import { ethers } from 'ethers-v5';
import { townsEnv, SpaceDapp } from '@towns-protocol/sdk';
import { createClient } from '@supabase/supabase-js';

// Validate required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}
if (!process.env.THIRDWEB_SECRET_KEY) {
  throw new Error('THIRDWEB_SECRET_KEY must be set');
}
if (!process.env.ENGINE_SERVER_WALLET_ADDRESS) {
  throw new Error('ENGINE_SERVER_WALLET_ADDRESS must be set');
}
if (!process.env.ENGINE_VAULT_ACCESS_TOKEN) {
  throw new Error('ENGINE_VAULT_ACCESS_TOKEN must be set');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create ThirdWeb client
const thirdwebClient = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY,
});

// Create Engine Server Wallet
const engineServerWallet = Engine.serverWallet({
  client: thirdwebClient,
  address: process.env.ENGINE_SERVER_WALLET_ADDRESS,
  vaultAccessToken: process.env.ENGINE_VAULT_ACCESS_TOKEN,
});

// Initialize Towns SDK config
const townsConfig = townsEnv().makeTownsConfig('omega', {
  baseChainRpcUrl: process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org'
});

export async function POST(request: NextRequest) {
  try {
    // Get request body (wallet address for tracking who initiated)
    const { walletAddress } = await request.json();

    console.log('🏗️ Creating Towns space via backend...');

    // Check if space already exists
    const { data: existingSpace } = await supabase
      .from('towns_spaces')
      .select('space_id, default_channel_id')
      .eq('is_active', true)
      .eq('space_name', 'Knead')
      .maybeSingle();

    if (existingSpace) {
      console.log('✅ Space already exists:', existingSpace);
      return NextResponse.json({
        success: true,
        spaceId: existingSpace.space_id,
        defaultChannelId: existingSpace.default_channel_id,
        alreadyExists: true,
      });
    }

    // Get Engine backend wallet address
    const backendWalletAddress = process.env.ENGINE_SERVER_WALLET_ADDRESS;

    console.log('📝 Using Engine wallet:', backendWalletAddress);

    // Create a provider using the RPC URL
    const provider = new ethers.providers.JsonRpcProvider(
      process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org'
    );

    // Create a custom signer that wraps the Engine wallet
    // This signer will intercept signing requests and route them through Engine
    const engineSigner = {
      getAddress: async () => backendWalletAddress,
      
      signMessage: async (message: string | Uint8Array) => {
        // Engine doesn't directly support message signing in the way Towns SDK needs
        // Instead, we'll use the signTypedData approach or handle it differently
        const messageString = typeof message === 'string' ? message : ethers.utils.hexlify(message);
        console.log('⚠️ Message signing requested:', messageString);
        throw new Error('Direct message signing not supported with Engine wallet. Towns SDK should use sendTransaction.');
      },
      
      signTransaction: async () => {
        throw new Error('Direct transaction signing not supported. Use sendTransaction instead.');
      },
      
      sendTransaction: async (transaction: ethers.providers.TransactionRequest) => {
        console.log('📤 Sending transaction via Engine:', transaction);
        
        // Use Engine's serverWallet to send the transaction
        const { transactionId } = await engineServerWallet.enqueueTransaction({
          transaction: {
            to: transaction.to as string,
            data: transaction.data as string,
            value: transaction.value ? BigInt(transaction.value.toString()) : 0n,
            chain: { id: 8453 }, // Base mainnet
          },
        } as { transaction: { to: string; data: string; value: bigint; chain: { id: number } } });

        console.log('🔄 Transaction enqueued with ID:', transactionId);

        // Wait for transaction hash
        const { transactionHash } = await Engine.waitForTransactionHash({
          client: thirdwebClient,
          transactionId,
        });

        console.log('✅ Transaction hash:', transactionHash);

        // Wait for transaction receipt
        const receipt = await provider.waitForTransaction(transactionHash);
        
        return receipt as ethers.providers.TransactionResponse;
      },
      
      connect: () => engineSigner,
      
      provider,
    } as ethers.Signer;

    // Create SpaceDapp instance
    const spaceDapp = new SpaceDapp(townsConfig.base.chainConfig, provider);

    console.log('🚀 Calling Towns SDK createSpace...');
    
    // Create the space using SpaceDapp
    const txn = await spaceDapp.createSpace(
      { spaceName: 'Knead' },
      engineSigner,
      {}
    );

    console.log('⏳ Waiting for space creation transaction...');
    
    // Wait for transaction to be mined
    const receipt = await txn.wait();
    
    console.log('✅ Space creation transaction mined:', receipt.transactionHash);

    // Parse the space creation event to get spaceId and defaultChannelId
    // The SpaceCreated event should contain this information
    const spaceInterface = spaceDapp.spaceRegistrar.interface;
    const spaceCreatedEvent = receipt.logs
      .map((log: ethers.providers.Log) => {
        try {
          return spaceInterface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((event: ethers.utils.LogDescription | null) => event?.name === 'SpaceCreated');

    if (!spaceCreatedEvent) {
      throw new Error('SpaceCreated event not found in transaction receipt');
    }

    const spaceId = spaceCreatedEvent.args.space;
    const defaultChannelId = spaceCreatedEvent.args.channelId || spaceCreatedEvent.args.defaultChannelId;

    console.log('✅ Space created:', { spaceId, defaultChannelId });

    // Save to Supabase
    const { error: insertError } = await supabase
      .from('towns_spaces')
      .insert({
        space_id: spaceId,
        space_name: 'Knead',
        default_channel_id: defaultChannelId,
        created_by: walletAddress || backendWalletAddress,
        is_active: true,
      });

    if (insertError) {
      console.error('⚠️ Failed to save to Supabase:', insertError);
      // Don't fail the request - space was created successfully
    }

    return NextResponse.json({
      success: true,
      spaceId,
      defaultChannelId,
      alreadyExists: false,
    });

  } catch (error: unknown) {
    console.error('❌ Failed to create space:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create Towns space';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
