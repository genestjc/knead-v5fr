import { ethers } from 'ethers';
import { connectTowns, townsEnv } from '@towns-protocol/sdk';

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================

const SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

// The wallet that owns/created the Towns Space (must have admin permissions)
const OWNER_PRIVATE_KEY = process.env.SPACE_OWNER_PRIVATE_KEY!;

// Your MetaMask address that needs admin permissions
const NEW_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET!;

// ============================================
// MAIN SCRIPT
// ============================================

const townsConfig = townsEnv().makeTownsConfig('omega', {
  rpcUrl: BASE_RPC_URL,
});

async function grantAdminPermissions() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔑 Granting Towns Space Admin Permissions');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Validate environment variables
  if (!SPACE_ID) {
    throw new Error('Missing NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID in .env');
  }

  if (!OWNER_PRIVATE_KEY) {
    throw new Error('Missing SPACE_OWNER_PRIVATE_KEY in .env');
  }

  if (!NEW_ADMIN_ADDRESS) {
    throw new Error('Missing NEXT_PUBLIC_MASTER_ADMIN_WALLET in .env');
  }

  console.log('📋 Configuration:');
  console.log(`   Space ID: ${SPACE_ID}`);
  console.log(`   New Admin: ${NEW_ADMIN_ADDRESS}`);
  console.log(`   Network: Base Mainnet (omega)`);
  console.log();

  // Create provider and wallet
  const provider = new ethers.providers.JsonRpcProvider(BASE_RPC_URL);
  const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
  
  console.log(`👤 Owner Wallet: ${ownerWallet.address}`);
  
  // Check wallet balance
  const balance = await ownerWallet.getBalance();
  const balanceInEth = ethers.utils.formatEther(balance);
  console.log(`💰 Owner Balance: ${balanceInEth} ETH`);
  
  if (balance.isZero()) {
    throw new Error('Owner wallet has no ETH! Please fund it to pay for gas.');
  }
  console.log();

  // Connect to Towns Protocol
  console.log('🔌 Connecting to Towns Protocol...');
  const agent = await connectTowns(ownerWallet, { 
    townsConfig,
    onTokenExpired: async () => {
      console.log('⚠️ Token expired');
    }
  });
  console.log('✅ Connected to Towns Protocol\n');

  // Get space info
  console.log('📍 Loading space...');
  const space = await agent.spaces.getSpace(SPACE_ID);
  console.log(`   Space Name: ${space.metadata?.name || 'Unknown'}`);
  console.log(`   Space Owner: ${await space.getOwner()}`);
  console.log();

  // Check if address already has permissions
  console.log('🔍 Checking current permissions...');
  try {
    const members = await space.getMembers();
    const existingMember = members.find(m => m.address.toLowerCase() === NEW_ADMIN_ADDRESS.toLowerCase());
    
    if (existingMember) {
      console.log(`   Current role: ${existingMember.role || 'member'}`);
      
      if (existingMember.role === 'admin' || existingMember.role === 'moderator') {
        console.log('ℹ️  Address already has admin/moderator permissions');
        const proceed = await confirmAction('Grant permissions anyway?');
        if (!proceed) {
          console.log('❌ Operation cancelled');
          process.exit(0);
        }
      }
    } else {
      console.log('   Not a member yet');
    }
  } catch (error: any) {
    console.log('⚠️  Could not check existing permissions:', error.message);
  }
  console.log();

  // Confirm action
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  You are about to grant ADMIN permissions');
  console.log(`   To: ${NEW_ADMIN_ADDRESS}`);
  console.log(`   In: ${space.metadata?.name || SPACE_ID}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  const confirmed = await confirmAction('Proceed with granting admin permissions?');
  if (!confirmed) {
    console.log('❌ Operation cancelled');
    process.exit(0);
  }

  // Grant admin role
  console.log('🚀 Granting admin permissions...');
  try {
    // Use 'moderator' role which includes Redact permission
    // You can also use 'admin' for full permissions
    await space.grantRole(NEW_ADMIN_ADDRESS, 'moderator');
    
    console.log('✅ SUCCESS! Admin permissions granted');
    console.log();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Next Steps:');
    console.log('   1. Sign in to your chat app with MetaMask');
    console.log('   2. Right-click (or long-press) a message');
    console.log('   3. Select "Delete Message"');
    console.log('   4. Confirm deletion');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error: any) {
    console.error('❌ FAILED to grant permissions');
    console.error('Error:', error.message);
    
    if (error.message?.includes('permission')) {
      console.error('\n💡 The owner wallet may not have sufficient permissions.');
      console.error('   Make sure you are using the wallet that created the space.');
    }
    
    throw error;
  }
}

// Helper function for confirmation prompts
function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question(`${message} (yes/no): `, (answer: string) => {
      readline.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Run the script
grantAdminPermissions()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });gr
