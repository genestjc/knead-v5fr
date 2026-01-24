import { NextRequest, NextResponse } from "next/server";
import {
  getContract,
  prepareContractCall,
  readContract,
  Engine,
} from "thirdweb";
import { base } from "thirdweb/chains";
import {
  client,
  serverWallet,
} from "../../../../thirdweb-server-wallet";

const MEMBERSHIP_CONTRACT = '0x616843F796B43E6ef972e7C345D2B06d85513543';
const TOKEN_ID = 464407n;
const GAS_LIMIT = 300000n;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { userAddress } = await req.json();
    
    if (!userAddress) {
      return NextResponse.json(
        { error: "Missing userAddress" },
        { status: 400 },
      );
    }

    console.log(`🎫 Checking membership for ${userAddress}...`);

    const membershipContract = getContract({
      client,
      address: MEMBERSHIP_CONTRACT,
      chain: base,
    });

    // Check if user already has the membership NFT
    const balance = await readContract({
      contract: membershipContract,
      method: 'function balanceOf(address,uint256) view returns (uint256)',
      params: [userAddress, TOKEN_ID],
    });

    if (balance > 0n) {
      console.log(`✅ User already has membership NFT`);
      return NextResponse.json({
        success: true,
        alreadyHasMembership: true,
        message: "User already has membership NFT",
      });
    }

    console.log(`🔨 Minting membership NFT for ${userAddress}...`);

    // Mint using server wallet (ERC-1155 mint pattern)
    const transaction = prepareContractCall({
      contract: membershipContract,
      method: 'function mint(address,uint256,uint256,bytes)',
      params: [userAddress, TOKEN_ID, 1n, '0x'],
      gasLimit: GAS_LIMIT,
    });

    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    console.log(`✅ Membership NFT minted: ${transactionHash}`);

    return NextResponse.json({
      success: true,
      transactionHash,
      transactionId,
      message: "Membership NFT minted successfully",
    });
  } catch (error: any) {
    console.error("❌ Error minting membership NFT:", error);
    return NextResponse.json(
      {
        error: error.message || "Mint failed",
        success: false,
      },
      { status: 500 },
    );
  }
}
