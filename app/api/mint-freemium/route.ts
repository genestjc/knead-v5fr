import { NextRequest, NextResponse } from "next/server";
import {
  createThirdwebClient,
  getContract,
  prepareContractCall,
  sendTransaction,
} from "thirdweb";
import { privateKeyAccount } from "thirdweb/wallets";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../../abi/kneadMembershipABI.json";

const FREEMIUM_TOKEN_ID = 0;

// Lazy-loaded client and wallet
let client: any;
let serverWallet: any;

function getThirdwebClient() {
  if (!client) {
    client = createThirdwebClient({
      clientId:
        process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "",
    });
  }
  return client;
}

function getServerWallet() {
  if (!serverWallet) {
    const privateKey =
      process.env.SERVER_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error(
        "Server wallet private key not found",
      );
    }
    serverWallet = privateKeyAccount({
      client: getThirdwebClient(),
      privateKey,
    });
  }
  return serverWallet;
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Move CONTRACT_ADDRESS inside the handler
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
    const client = getThirdwebClient();
    const serverWallet = getServerWallet();

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
    });

    const result = await sendTransaction({
      account: serverWallet,
      transaction,
    });

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
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
