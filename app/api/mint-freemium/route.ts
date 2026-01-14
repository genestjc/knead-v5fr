import { NextRequest, NextResponse } from "next/server";
import { prepareContractCall, Engine } from "thirdweb";
import { getMembershipContract } from "@/lib/contracts/getters";
import { checkTokenOwnership } from "@/lib/contracts/helpers";
import { client, serverWallet } from "../../../thirdweb-server-wallet";
import { logger } from "@/lib/logger";

const FREEMIUM_TOKEN_ID = 0;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { address } = await req.json();
  if (!address) {
    return NextResponse.json(
      { error: "Missing address" },
      { status: 400 },
    );
  }

  try {
    // Use shared helper to check token ownership
    const { owned } = await checkTokenOwnership(address, BigInt(FREEMIUM_TOKEN_ID));

    if (owned) {
      return NextResponse.json({
        success: true,
        alreadyMinted: true,
        message: "User already has freemium NFT",
      });
    }

    const contract = getMembershipContract();

    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [address, BigInt(FREEMIUM_TOKEN_ID), 1n],
      gasLimit: 300000n,
    });

    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    return NextResponse.json({
      success: true,
      transactionHash,
      transactionId,
      message: "Freemium NFT minted",
    });
  } catch (error: any) {
    logger.error("Error minting freemium NFT:", error);
    return NextResponse.json(
      {
        error: "Mint failed",
        success: false,
      },
      { status: 500 },
    );
  }
}
