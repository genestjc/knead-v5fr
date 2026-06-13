import { NextRequest, NextResponse } from "next/server";
import {
  getContract,
  prepareContractCall,
} from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../../abi/kneadMembershipABI.json";
import { createClient } from "@supabase/supabase-js";
import { client, serverWallet } from "../../../thirdweb-server-wallet";
import { verifyAdminRequest } from "@/lib/admin/verify-admin-request";

/**
 * FALLBACK: Engine server wallet minting route
 *
 * This API route uses ThirdWeb Engine's server wallet to mint VIP memberships.
 * It is kept as a fallback in case direct wallet minting is unavailable.
 *
 * PRIMARY path: MonthlyMintManager component uses direct wallet minting via
 * useSendTransaction hook, which bypasses this route entirely.
 *
 * USE THIS ROUTE IF:
 * - Engine server wallet nonce is healthy (check ThirdWeb dashboard)
 * - You need to mint programmatically without a connected browser wallet
 *
 * KNOWN ISSUE: ThirdWeb Engine server wallet (0x8659...7A10) had a stuck nonce
 * on Base on 2026-02-23. If minting fails, check Engine dashboard first.
 */

export const maxDuration = 60;

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET?.toLowerCase() || '';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    // ✅ Verify admin authentication via wallet signature
    const auth = await verifyAdminRequest(req, { requireMaster: true });
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
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

    // Check if user already has premium membership
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

    // Prepare mint transaction
    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [user_address, 1n, 1n],
      gasLimit: 300000n,
    });

    // Execute transaction via Engine
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    // Update Supabase if email provided
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
      transactionId,
      message: "VIP membership mint enqueued successfully. Will confirm on-chain in ~30-60 seconds.",
    });
  } catch (error) {
    console.error("VIP mint error:", error);
    return NextResponse.json(
      { error: "Failed to mint VIP token" },
      { status: 500 },
    );
  }
}
