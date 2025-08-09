"use client"

import { useState, useCallback, useEffect } from "react"
import { createThirdwebClient, getContract } from "thirdweb"
import { balanceOf } from "thirdweb/extensions/erc1155"
import { base } from "thirdweb/chains"
import { useToast } from "./use-toast"

// Membership status types
type MembershipStatus = "loading" | "none" | "freemium" | "premium" | "error"

// Mint result type
type MintResult = {
  success: boolean
  error?: string
  transactionHash?: string
}

// Contract details
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as string
const TOKEN_IDS = {
  FREEMIUM: 0,
  PREMIUM: 1,
}

// Create client
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || 
    (process.env.NODE_ENV !== "production" ? "44984f2bc038cebc6138d4ceb602c35d" : undefined),
})

export function useFreemiumMembership(userAddress: string | null) {
  const [status, setStatus] = useState<MembershipStatus>("loading")
  const [minting, setMinting] = useState(false)
  const [mintResult, setMintResult] = useState<MintResult | null>(null)
  const { toast } = useToast()

  // Check membership status
  const checkMembership = useCallback(async () => {
    if (!userAddress || !CONTRACT_ADDRESS) {
      setStatus("none")
      return
    }

    try {
      setStatus("loading")
      console.log(`Checking membership for ${userAddress}`)

      const contract = getContract({
        client,
        address: CONTRACT_ADDRESS,
        chain: base,
      })

      // Check both tokens in parallel for efficiency
      const [freemiumBalance, premiumBalance] = await Promise.all([
        balanceOf({
          contract,
          owner: userAddress,
          tokenId: BigInt(TOKEN_IDS.FREEMIUM),
        }),
        balanceOf({
          contract,
          owner: userAddress,
          tokenId: BigInt(TOKEN_IDS.PREMIUM),
        }),
      ])

      // Determine membership type
      if (premiumBalance > 0n) {
        console.log(`User ${userAddress} has premium membership`)
        setStatus("premium")
      } else if (freemiumBalance > 0n) {
        console.log(`User ${userAddress} has freemium membership`)
        setStatus("freemium")
      } else {
        console.log(`User ${userAddress} has no membership`)
        setStatus("none")
      }
    } catch (error) {
      console.error("Error checking membership:", error)
      setStatus("error")
    }
  }, [userAddress])

  // Mint freemium token
  const mintFreemium = useCallback(async () => {
    if (!userAddress) {
      setMintResult({
        success: false,
        error: "No wallet address provided",
      })
      return
    }

    setMinting(true)
    setMintResult(null)

    try {
      console.log(`Minting freemium token for ${userAddress}`)
      
      const response = await fetch("/api/mint-freemium", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: userAddress,
        }),
      })

      const data = await response.json()
      
      if (response.ok && (data.success || data.alreadyMinted)) {
        console.log("Mint successful or already minted:", data)
        setMintResult({
          success: true,
          transactionHash: data.transactionHash,
        })
        
        // Update status to reflect new membership
        setStatus("freemium")
        
        toast({
          title: data.alreadyMinted ? "Membership Verified" : "Membership Activated",
          description: data.alreadyMinted 
            ? "You already have free membership access" 
            : "Your free membership has been activated!",
        })
      } else {
        console.error("Mint error:", data)
        setMintResult({
          success: false,
          error: data.error || "Failed to mint freemium token",
        })
        
        toast({
          title: "Membership Error",
          description: data.error || "Failed to activate your membership",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Error minting freemium:", error)
      setMintResult({
        success: false,
        error: error.message || "An unexpected error occurred",
      })
      
      toast({
        title: "Error",
        description: "Failed to process your membership request",
        variant: "destructive",
      })
    } finally {
      setMinting(false)
    }
  }, [userAddress, toast])

  // Automatically check membership on mount and when wallet changes
  useEffect(() => {
    if (userAddress) {
      checkMembership()
    } else {
      setStatus("none")
    }
  }, [userAddress, checkMembership])

  return {
    status,
    checkMembership,
    minting,
    mintFreemium,
    mintResult,
  }
}
