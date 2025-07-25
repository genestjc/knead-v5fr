import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient } from "thirdweb";
import { getMembershipType } from "@/lib/membership";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  if (!address)
    return NextResponse.json(
      { error: "Missing address" },
      { status: 400 },
    );

  try {
    const membershipType = await getMembershipType(
      client,
      address,
    );
    return NextResponse.json({ membershipType });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check membership" },
      { status: 500 },
    );
  }
}
