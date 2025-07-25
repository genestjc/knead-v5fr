import { type NextRequest, NextResponse } from "next/server"
import { createThirdwebClient, getContract } from "thirdweb"
import { balanceOf } from "thirdweb/extensions/erc1155"
import { balanceOf as erc721BalanceOf } from "thirdweb/extensions/erc721"
import { base } from "thirdweb/chains"

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
})

// NFT Collections that provide access to all content
const MEMBERSHIP_CONTRACTS = [
  {
    address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!, // Main Knead Membership
    name: "Knead Membership",
    type: "erc1155",
    tokenIds: {
      premium: 1, // Premium membership token ID
      freemium: 0, // Freemium membership token ID
    },
  },
  {
    address: "0x0e70AB324E8761E97F131Eecc4Dd63dFDE33cB72", // Breadwinner's Club
    name: "Breadwinner's Club Membership",
    type: "erc721",
  },
  {
    address: "0xa4b1aF8cffEE71D71721cB69596C9A31ac449F13", // 2025 Annual + Shift Meal
    name: "2025 Annual + Shift Meal Membership",
    type: "erc1155",
    tokenIds: {
      annual: 1, // 2025 Annual token ID
      shift: 2, // Shift Meal token ID
    },
  },
] as const

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get("address")

  if (!address) {
    return NextResponse.json({ error: "Missing address parameter" }, { status: 400 })
  }

  try {
    // Check all membership contracts for access
    for (const contract of MEMBERSHIP_CONTRACTS) {
      const contractInstance = getContract({
        client,
        chain: base,
        address: contract.address,
      })

      if (contract.type === "erc1155") {
        // For ERC1155 contracts, check specific token IDs
        if (contract.tokenIds) {
          // Check premium access first
          if (contract.tokenIds.premium !== undefined) {
            try {
              const premiumBalance = await balanceOf({
                contract: contractInstance,
                owner: address,
                tokenId: BigInt(contract.tokenIds.premium),
              })

              if (premiumBalance > 0n) {
                return NextResponse.json({ membershipType: "premium" })
              }
            } catch (error) {
              console.error(`Error checking premium balance for ${contract.name}:`, error)
            }
          }

          // Check other token IDs (annual, shift, etc.)
          for (const [tokenType, tokenId] of Object.entries(contract.tokenIds)) {
            if (tokenType !== "premium" && tokenType !== "freemium") {
              try {
                const balance = await balanceOf({
                  contract: contractInstance,
                  owner: address,
                  tokenId: BigInt(tokenId),
                })

                if (balance > 0n) {
                  return NextResponse.json({ membershipType: "premium" })
                }
              } catch (error) {
                console.error(`Error checking ${tokenType} balance for ${contract.name}:`, error)
              }
            }
          }

          // Check freemium access last
          if (contract.tokenIds.freemium !== undefined) {
            try {
              const freemiumBalance = await balanceOf({
                contract: contractInstance,
                owner: address,
                tokenId: BigInt(contract.tokenIds.freemium),
              })

              if (freemiumBalance > 0n) {
                return NextResponse.json({ membershipType: "freemium" })
              }
            } catch (error) {
              console.error(`Error checking freemium balance for ${contract.name}:`, error)
            }
          }
        }
      } else if (contract.type === "erc721") {
        // For ERC721 contracts, check balance
        try {
          const balance = await erc721BalanceOf({
            contract: contractInstance,
            owner: address,
          })

          if (balance > 0n) {
            return NextResponse.json({ membershipType: "premium" })
          }
        } catch (error) {
          console.error(`Error checking ERC721 balance for ${contract.name}:`, error)
        }
      }
    }

    // No membership found
    return NextResponse.json({ membershipType: null })
  } catch (error) {
    console.error("Error checking membership:", error)
    return NextResponse.json({ error: "Failed to check membership" }, { status: 500 })
  }
}
