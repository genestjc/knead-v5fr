import { NextRequest, NextResponse } from "next/server";
import {
  getContract,
  prepareContractCall,
  Engine,
} from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../../abi/kneadMembershipABI.json";
import {
  client,
  serverWallet,
} from "../../../thirdweb-server-wallet";

const FREEMIUM_TOKEN_ID = 0;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const CONTRACT_ADDRESS =
    process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
  const { address } = await req.json();
  if (!address) {
    return NextResponse.json(
      { error: "Missing address" },
      { status: 400 },
    );
  }

  try {
    if (!CONTRACT_ADDRESS) {
      throw new Error(
        "NFT contract address not configured",
      );
    }

    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });

    const freemiumBalance = await balanceOf({
      contract,
      owner: address,
      tokenId: BigInt(FREEMIUM_TOKEN_ID),
    });

    if (freemiumBalance > 0n) {
      return NextResponse.json({
        success: true,
        alreadyMinted: true,
        message: "User already has freemium NFT",
      });
    }

    const transaction = prepareContractCall({
      contract,
      method:
        "function mint(address to, uint256 id, uint256 amount)",
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
    console.error("Error minting freemium NFT:", error);
    return NextResponse.json(
      {
        error: error.message || "Mint failed",
        success: false,
      },
      { status: 500 },
    );
  }
}
