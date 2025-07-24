import { type NextRequest, NextResponse } from "next/server"
import { createThirdwebClient, getContract } from "thirdweb"
import { privateKeyToAccount } from "thirdweb/wallets"
import { mintTo } from "thirdweb/extensions/erc1155"
import { base } from "thirdweb/chains"

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
})

const account = privateKeyToAccount({
  client,
  privateKey: process.env.THIRDWEB_PRIVATE_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    const { user_address, email } = await req.json()

    if (!user_address || !email) {
      return NextResponse.json({ error: "Missing user_address or email" }, { status: 400 })
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(user_address)) {
      return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 })
    }

    const contract = getContract({
      client,
      chain: base,
      address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!,
    })

    // Mint premium membership token (token ID 1)
    const transaction = mintTo({
      contract,
      to: user_address,
      tokenId: BigInt(1), // Premium membership
      quantity: BigInt(1),
    })

    const result = await transaction({
      account,
    })

    console.log("VIP mint successful:", {
      user_address,
      email,
      transactionHash: result.transactionHash,
    })

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
    })
  } catch (error) {
    console.error("VIP mint error:", error)
    return NextResponse.json({ error: "Failed to mint VIP token" }, { status: 500 })
  }
}
