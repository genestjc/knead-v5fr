import { NextRequest, NextResponse } from "next/server";
import { ThirdwebSDK } from "thirdweb";

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
    const sdk = ThirdwebSDK.fromPrivateKey(
      process.env.THIRDWEB_PRIVATE_KEY!,
      "base",
    );
    const contract = await sdk.getContract(
      CONTRACT_ADDRESS,
    );

    await contract.call("mint", [
      user_address,
      FREEMIUM_TOKEN_ID,
      1,
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
}
