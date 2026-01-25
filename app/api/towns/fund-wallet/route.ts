import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { userAddress } = await req.json();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("ℹ️ Gas funding skipped (not needed on Base)");
  console.log(`   User: ${userAddress}`);
  console.log("   - In-app wallets have gas sponsorship");
  console.log("   - Base gas costs: ~$0.001 per transaction");
  console.log("   - Most users already have sufficient gas");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  return NextResponse.json({
    success: true,
    skipped: true,
    message: "Gas funding not needed - users have sufficient funds",
  });
}
