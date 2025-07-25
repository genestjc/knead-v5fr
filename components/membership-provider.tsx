"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { useActiveAccount } from "thirdweb/react"
import { createThirdwebClient, getContract } from "thirdweb"
import { balanceOf } from "thirdweb/extensions/erc1155"
import { balanceOf as erc721BalanceOf } from "thirdweb/extensions/erc721"
import { base } from "thirdweb/chains"
import { OnboardFreemium } from "./onboard-freemium"
import { useThirdwebUser } from "@/hooks/use-thirdweb-user"

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

type MembershipType = "freemium" | "premium" | null

interface MembershipContextType {
  membershipType: MembershipType
  isLoading: boolean
  walletAddress: string | undefined
  userEmail: string | null
  hasAccess: (requiredTier?: "freemium" | "premium") => boolean
  articlesRemaining: number
  refreshMembership: () => Promise<void>
}

const MembershipContext = createContext<MembershipContextType | undefined>(undefined)

export function MembershipProvider({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount()
  const { userEmail, isLoading: emailLoading } = useThirdwebUser()
  const [membershipType, setMembershipType] = useState<MembershipType>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [articlesRemaining, setArticlesRemaining] = useState(0)

  const checkMembership = async (walletAddress: string) => {
    setIsLoading(true)
    console.log("Checking membership for wallet:", walletAddress)

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
                  console.log("Freemium access found!")
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
              setIsLoading(false)
              return
            }
          } catch (error) {
            console.error(`Error checking ERC721 balance for ${contract.name}:`, error)
          }
        }
      }

      // No membership found
      console.log("No membership access found")
      setMembershipType(null)
    } catch (error) {
      console.error("Error checking membership:", error)
      setMembershipType(null)
    } finally {
      setIsLoading(false)
    }
  }

  const checkFreemiumLimit = async (walletAddress: string) => {
    try {
      const response = await fetch("/api/track-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_address: walletAddress.toLowerCase(),
          checkOnly: true,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setArticlesRemaining(Math.max(0, 3 - result.reads))
      } else {
        setArticlesRemaining(0)
      }
    } catch (error) {
      console.error("Error checking freemium limit:", error)
      setArticlesRemaining(0)
    }
  }

  const refreshMembership = async () => {
    if (account?.address) {
      await checkMembership(account.address)
    }
  }

  const hasAccess = (requiredTier: "freemium" | "premium" = "freemium") => {
    if (requiredTier === "freemium") {
      return membershipType === "freemium" || membershipType === "premium"
    }
    return membershipType === "premium"
  }

  useEffect(() => {
    if (account?.address) {
      checkMembership(account.address)
    } else {
      setMembershipType(null)
      setIsLoading(false)
      setArticlesRemaining(0)
    }
  }, [account?.address])

  const contextValue: MembershipContextType = {
    membershipType,
    isLoading: isLoading || emailLoading,
    walletAddress: account?.address,
    userEmail,
    hasAccess,
    articlesRemaining,
    refreshMembership,
  }

  return (
    <MembershipContext.Provider value={contextValue}>
      {children}
      <OnboardFreemium />
    </MembershipContext.Provider>
  )
}

export function useMembership() {
  const context = useContext(MembershipContext)
  if (context === undefined) {
    throw new Error("useMembership must be used within a MembershipProvider")
  }
  return context
}
