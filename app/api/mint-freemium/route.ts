import { NextRequest, NextResponse } from "next/server";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  balanceOf,
} from "thirdweb";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../../abi/kneadMembershipABI.json";
import { client, serverWallet } from "../../../thirdweb-server-wallet";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
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
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });

    const balance = await balanceOf({
      contract,
      owner: user_address,
      tokenId: 0n,
    });
    if (balance > 0n) {
      return NextResponse.json({ success: true, alreadyMinted: true });
    }

    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [user_address, 0n, 1n],
    });

    await sendTransaction({
      account: serverWallet,
      transaction,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Mint error:", error);
    return NextResponse.json(
      { error: error.message || "Mint failed" },
      { status: 500 },
    );
  }
}
