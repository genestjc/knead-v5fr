import { ethers } from 'ethers';
import { connectTowns, townsEnv } from '@towns-protocol/sdk';

const SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
const KEY_SHARER_PRIVATE_KEY = process.env.KEY_SHARER_PRIVATE_KEY!;
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

const townsConfig = townsEnv().makeTownsConfig('omega', {
  rpcUrl: BASE_RPC_URL,
});

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔑 Knead Chat - Persistent Key Sharer');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!SPACE_ID) {
    throw new Error('Missing NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID');
  }

  if (!KEY_SHARER_PRIVATE_KEY) {
    throw new Error('Missing KEY_SHARER_PRIVATE_KEY');
  }

  // Create provider and wallet
  const provider = new ethers.providers.JsonRpcProvider(BASE_RPC_URL);
  const wallet = new ethers.Wallet(KEY_SHARER_PRIVATE_KEY, provider);
  
  console.log('📋 Configuration:');
  console.log(`   Space ID: ${SPACE_ID}`);
  console.log(`   Wallet Address: ${wallet.address}`);
  console.log(`   Network: Base Mainnet`);
  console.log();

  // Check wallet balance
  const balance = await wallet.getBalance();
  const balanceInEth = ethers.utils.formatEther(balance);
  console.log(`💰 Wallet Balance: ${balanceInEth} ETH`);
  
  if (balance.isZero()) {
    console.error('❌ Wallet has no ETH! Please fund it.');
    process.exit(1);
  }
  console.log();

  // Connect to Towns Protocol
  console.log('🔌 Connecting to Towns Protocol...');
  const agent = await connectTowns(wallet, { 
    townsConfig,
    onTokenExpired: async () => {
      console.log('⚠️ Token expired, reconnecting...');
    }
  });
  console.log('✅ Connected to Towns Protocol\n');

  // Get space info
  console.log('📍 Checking space membership...');
  try {
    const space = await agent.spaces.getSpace(SPACE_ID);
    console.log(`   Space Name: ${space.metadata?.name || 'Unknown'}`);
    
    const isMember = await space.isMember(wallet.address);
    
    if (!isMember) {
      console.log('🚪 Joining space...');
      await space.joinSpace(wallet);
      console.log('✅ Joined space');
    } else {
      console.log('✅ Already a member');
    }
  } catch (error: any) {
    if (error.message?.includes('already a member')) {
      console.log('✅ Already a member');
    } else {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }
  console.log();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🟢 KEY SHARER IS NOW ONLINE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📡 Sharing encryption keys with new members');
  console.log('⏰ Started:', new Date().toISOString());
  console.log();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n⚠️ Shutting down...');
    agent.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('\n⚠️ Shutting down...');
    agent.stop();
    process.exit(0);
  });

  // Heartbeat every 30 minutes
  setInterval(() => {
    console.log('💓 Online:', new Date().toISOString());
  }, 30 * 60 * 1000);

  // Status check every 6 hours
  setInterval(async () => {
    const currentBalance = await wallet.getBalance();
    const balanceEth = ethers.utils.formatEther(currentBalance);
    console.log('📊 Status:', new Date().toISOString());
    console.log(`   Balance: ${balanceEth} ETH\n`);
  }, 6 * 60 * 60 * 1000);
}

main().catch((error) => {
  console.error('❌ FATAL ERROR:', error.message);
  process.exit(1);
});
