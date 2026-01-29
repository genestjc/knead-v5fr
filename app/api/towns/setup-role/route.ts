import { NextRequest, NextResponse } from "next/server";
import { makeTownsBot } from '@towns-protocol/bot';
import { Permission } from '@towns-protocol/web3';

export const dynamic = "force-dynamic";

const SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
const SERVER_WALLET = '0x8659096DE4dc09b48F0414DbD868b3792b557A10';
const SETUP_SECRET = process.env.SETUP_SECRET || 'change-me-in-production';

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json();
    
    if (secret !== SETUP_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 Creating Backend Minter Role');
    console.log(`   Space ID: ${SPACE_ID}`);
    console.log(`   Server Wallet: ${SERVER_WALLET}`);

    // Use the correct env var names
    const appPrivateData = process.env.MINTER_BOT_APP_PRIVATE_DATA;
    const jwtSecret = process.env.MINTER_BOT_JWT_SECRET;
    
    if (!appPrivateData || !jwtSecret) {
      throw new Error('Bot credentials not found. Check MINTER_BOT_APP_PRIVATE_DATA and MINTER_BOT_JWT_SECRET');
    }

    console.log('🔧 Initializing bot...');
    
    const bot = await makeTownsBot(appPrivateData, jwtSecret, {
      baseRpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'
    });
    
    console.log('✅ Bot initialized');
    console.log('🔧 Creating role and assigning to ThirdWeb wallet...');
    
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
      message: 'Backend Minter role created! ThirdWeb wallet can now mint memberships.',
    });

  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Role creation failed:', error);
    console.error('   Message:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create role',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}
