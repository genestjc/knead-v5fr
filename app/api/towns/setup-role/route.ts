import { NextRequest, NextResponse } from "next/server";
import { makeTownsBot } from '@towns-protocol/bot';
import { Permission } from '@towns-protocol/web3';
import { ethers } from 'ethers-v5';

export const dynamic = "force-dynamic";

const SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
const SERVER_WALLET = '0x8659096DE4dc09b48F0414DbD868b3792b557A10';
const SETUP_SECRET = process.env.SETUP_SECRET || 'change-me-in-production';

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json();
    
    // Security: Only allow with correct secret
    if (secret !== SETUP_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 Creating Backend Minter Role');
    console.log(`   Space ID: ${SPACE_ID}`);
    console.log(`   Server Wallet: ${SERVER_WALLET}`);

    // Get owner wallet private key from env
    const ownerPrivateKey = process.env.OWNER_WALLET_PRIVATE_KEY;
    if (!ownerPrivateKey) {
      throw new Error('OWNER_WALLET_PRIVATE_KEY not set in environment');
    }

    // Initialize provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(
      'https://mainnet.base.org'
    );
    const ownerWallet = new ethers.Wallet(ownerPrivateKey, provider);
    
    console.log(`   Owner wallet: ${ownerWallet.address}`);

    // Initialize bot using makeTownsBot
    console.log('\n🔧 Initializing bot...');
    const bot = await makeTownsBot(ownerWallet, 'omega'); // 'omega' = mainnet
    
    console.log('🔧 Creating role...');
    
    // Create the Backend Minter role
    const { roleId } = await bot.createRole(SPACE_ID, {
      name: 'Backend Minter',
      permissions: [Permission.Write],
      users: [SERVER_WALLET]
    });
    
    console.log('✅ Role created successfully!');
    console.log(`   Role ID: ${roleId}`);
    console.log(`   Assigned to: ${SERVER_WALLET}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json({
      success: true,
      roleId,
      serverWallet: SERVER_WALLET,
      spaceId: SPACE_ID,
      message: 'Backend Minter role created successfully!',
    });

  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Role creation failed:', error);
    console.error('   Message:', error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create role',
    }, { status: 500 });
  }
}
