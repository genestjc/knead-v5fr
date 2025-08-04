import { NextRequest, NextResponse } from "next/server";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  balanceOf,
} from "thirdweb";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../../abi/kneadMembershipABI.json";
import { verifyVipToken } from "@/lib/verify-vip-token";
import { createClient } from "@supabase/supabase-js";
import { client, serverWallet } from "../../../thirdweb-server-wallet";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 },
      );
    }

    const token = authHeader.substring(7);
    if (!verifyVipToken(token)) {
      return NextResponse.json(
        { error: "Invalid or expired VIP access token" },
        { status: 401 },
      );
    }

    const { user_address, email } = await req.json();

    if (!user_address) {
      return NextResponse.json(
        { error: "Missing user_address" },
        { status: 400 },
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(user_address)) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 },
      );
    }

    const contract = getContract({
      client,
      chain: base,
      address: CONTRACT_ADDRESS,
      abi: kneadMembershipABI,
    });

    const balance = await balanceOf({
      contract,
      owner: user_address,
      tokenId: 1n,
    });

    if (balance > 0n) {
      return NextResponse.json({
        success: true,
        alreadyMinted: true,
        message: "User already has a premium membership",
      });
    }

    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [user_address, 1n, 1n],
    });

    await sendTransaction({
      account: serverWallet,
      transaction,
    });

    if (email) {
      await supabase.from("users").upsert(
        {
          wallet_address: user_address.toLowerCase(),
          email: email,
          membership_status: "premium",
          membership_type: "vip",
          created_at: new Date().toISOString(),
        },
        { onConflict: ["wallet_address"] },
      );
    }

    return NextResponse.json({
      success: true,
      message: "VIP membership minted successfully",
    });
  } catch (error) {
    console.error("VIP mint error:", error);
    return NextResponse.json(
      { error: "Failed to mint VIP token" },
      { status: 500 },
    );
  }
}
