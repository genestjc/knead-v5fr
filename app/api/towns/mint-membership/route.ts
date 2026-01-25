import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;

// Simple in-memory rate limiting (use Redis/KV in production)
const validationAttempts = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const { userAddress, spaceId } = await req.json();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎫 Validating Membership Request');
    console.log(`   User: ${userAddress}`);
    console.log(`   Space: ${spaceId}`);

    // 🔒 Validation 1: Required fields
    if (!userAddress || !spaceId) {
      console.error('❌ Missing required fields');
      return NextResponse.json({ 
        error: 'Missing required fields: userAddress and spaceId are required.' 
      }, { status: 400 });
    }

    // 🔒 Validation 2: Only allow your space
    if (spaceId !== ALLOWED_SPACE_ID) {
      console.warn('⚠️ Invalid space ID attempt:', spaceId);
      return NextResponse.json({ 
        error: 'Invalid space ID' 
      }, { status: 400 });
    }

    // 🔒 Validation 3: IP rate limiting (basic)
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'unknown';
    const ipKey = `ip:${ip}`;
    const ipCount = validationAttempts.get(ipKey) || 0;
    
    if (ipCount >= 10) {
      console.warn('⚠️ Rate limit exceeded for IP:', ip);
      return NextResponse.json({ 
        error: 'Rate limit exceeded. Please try again later.' 
      }, { status: 429 });
    }
    
    validationAttempts.set(ipKey, ipCount + 1);
    setTimeout(() => validationAttempts.delete(ipKey), 60 * 60 * 1000); // Clear after 1 hour

    console.log('✅ Validation passed');
    console.log('   Towns SDK will handle NFT minting during joinSpace()');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json({
      success: true,
      message: "Towns SDK will mint the membership NFT during join",
      validated: true,
    });

  } catch (error: any) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error("❌ Validation error:");
    console.error("   Message:", error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return NextResponse.json(
      {
        error: error.message || "Validation failed",
        success: false,
      },
      { status: 500 }
    );
  }
}
