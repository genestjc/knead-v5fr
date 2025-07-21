"use client"

import { useState, useEffect, type ReactNode } from "react"
import { useActiveAccount } from "thirdweb/react"
import { createThirdwebClient, getContract } from "thirdweb"
import { balanceOf } from "thirdweb/extensions/erc1155"
import { balanceOf as erc721BalanceOf } from "thirdweb/extensions/erc721"
import { base } from "thirdweb/chains"
import { ThirdWebConnectButton } from "./thirdweb-connect-button"

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
]

interface UnlockContentProps {
  children: ReactNode
  storySlug?: string
}

export function UnlockContent({ children, storySlug }: UnlockContentProps) {
  const account = useActiveAccount()
  const [hasAccess, setHasAccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [membershipType, setMembershipType] = useState<"freemium" | "premium" | null>(null)
  const [articlesRemaining, setArticlesRemaining] = useState(0)

  useEffect(() => {
    if (account?.address) {
      checkAccess(account.address)
    } else {
      setHasAccess(false)
      setIsLoading(false)
    }
  }, [account?.address, storySlug])

  const checkAccess = async (walletAddress: string) => {
    setIsLoading(true)
    console.log("Checking access for wallet:", walletAddress)

    try {
      // Check all membership contracts for access
      for (const contract of MEMBERSHIP_CONTRACTS) {
        console.log(`Checking contract: ${contract.name} (${contract.address})`)

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
                  owner: walletAddress,
                  tokenId: BigInt(contract.tokenIds.premium),
                })
                console.log(`Premium balance for ${contract.name}:`, premiumBalance.toString())

                if (premiumBalance > 0n) {
                  console.log("Premium access granted!")
                  setMembershipType("premium")
                  setHasAccess(true)
                  setIsLoading(false)
                  return
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
                    owner: walletAddress,
                    tokenId: BigInt(tokenId),
                  })
                  console.log(`${tokenType} balance for ${contract.name}:`, balance.toString())

                  if (balance > 0n) {
                    console.log(`Premium access granted via ${tokenType}!`)
                    setMembershipType("premium")
                    setHasAccess(true)
                    setIsLoading(false)
                    return
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
                  owner: walletAddress,
                  tokenId: BigInt(contract.tokenIds.freemium),
                })
                console.log(`Freemium balance for ${contract.name}:`, freemiumBalance.toString())

                if (freemiumBalance > 0n) {
                  console.log("Freemium access found, checking limits...")
                  setMembershipType("freemium")
                  await checkFreemiumLimit(walletAddress)
                  setIsLoading(false)
                  return
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
              owner: walletAddress,
            })
            console.log(`ERC721 balance for ${contract.name}:`, balance.toString())

            if (balance > 0n) {
              console.log("Premium access granted via ERC721!")
              setMembershipType("premium")
              setHasAccess(true)
              setIsLoading(false)
              return
            }
          } catch (error) {
            console.error(`Error checking ERC721 balance for ${contract.name}:`, error)
          }
        }
      }

      // No access found
      console.log("No membership access found")
      setMembershipType(null)
      setHasAccess(false)
    } catch (error) {
      console.error("Error checking access:", error)
      setHasAccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const checkFreemiumLimit = async (walletAddress: string) => {
    try {
      const response = await fetch("/api/check-article-limit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: walletAddress.toLowerCase(),
          storySlug,
        }),
      })

      const result = await response.json()

      if (result.canRead) {
        setHasAccess(true)
        setArticlesRemaining(result.articlesRemaining)
      } else {
        setHasAccess(false)
        setArticlesRemaining(0)
      }
    } catch (error) {
      console.error("Error checking freemium limit:", error)
      setHasAccess(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        <span className="ml-3 text-gray-600 font-georgia-pro">Checking access...</span>
      </div>
    )
  }

  if (hasAccess) {
    return <>{children}</>
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center max-w-2xl mx-auto my-8">
      <div className="mb-6">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>

      <h3 className="text-xl font-adonis text-gray-900 mb-4">
        {!account ? "Sign In to Continue" : "Membership Required"}
      </h3>

      {!account ? (
        <>
          <p className="text-gray-600 mb-6 font-georgia-pro">
            Sign in to access this story. New users get 3 free articles per month!
          </p>
          <ThirdWebConnectButton className="mx-auto" />
        </>
      ) : membershipType === "freemium" ? (
        <>
          <p className="text-gray-600 mb-4 font-georgia-pro">You've reached your monthly article limit.</p>
          <p className="text-gray-600 mb-6 font-georgia-pro">Upgrade to premium for unlimited access to all stories.</p>
          <button
            onClick={() => (window.location.href = "/test-membership")}
            className="bg-black text-white px-6 py-3 rounded-lg font-georgia-pro hover:bg-gray-800 transition-colors"
          >
            Upgrade to Premium
          </button>
        </>
      ) : (
        <>
          <p className="text-gray-600 mb-6 font-georgia-pro">This story requires a Knead membership to access.</p>
          <button
            onClick={() => (window.location.href = "/test-membership")}
            className="bg-black text-white px-6 py-3 rounded-lg font-georgia-pro hover:bg-gray-800 transition-colors"
          >
            Get Membership
          </button>
        </>
      )}
    </div>
  )
}
