import { NextRequest, NextResponse } from "next/server";

const CONTRACT_ADDRESS =
  "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85";
const FREEMIUM_TOKEN_ID = 0;

export async function POST(req: NextRequest) {
  const { user_address } = await req.json();
  if (!user_address) {
    return NextResponse.json(
      { error: "Missing user_address" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `https://api.thirdweb.com/v1/contract/${CONTRACT_ADDRESS}/erc1155/mint-to`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.THIRDWEB_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: user_address,
          tokenId: FREEMIUM_TOKEN_ID,
          amount: 1,
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || "Mint failed" },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, tx: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
}
