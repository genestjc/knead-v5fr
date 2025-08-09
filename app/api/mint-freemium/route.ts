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
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

const serverWallet = privateKeyAccount({
  client,
  privateKey: process.env.SERVER_WALLET_PRIVATE_KEY!,
});

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
      gasLimit: 300000n,
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
