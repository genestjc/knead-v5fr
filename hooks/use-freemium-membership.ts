"use client"

import { useState, useCallback, useEffect, useRef } from "react"
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

// Auto-minting configuration
const MAX_AUTO_MINT_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

// Create client
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || 
    (process.env.NODE_ENV !== "production" ? "44984f2bc038cebc6138d4ceb602c35d" : undefined),
})

// Track minting attempts to prevent multiple simultaneous mints
const mintingAddresses = new Set<string>();

export function useFreemiumMembership(userAddress: string | null) {
  const [status, setStatus] = useState<MembershipStatus>("loading")
  const [minting, setMinting] = useState(false)
  const [mintResult, setMintResult] = useState<MintResult | null>(null)
  const { toast } = useToast()
  
  // Track auto-mint attempts and retries
  const autoMintAttempted = useRef<boolean>(false);
  const retryCount = useRef<number>(0);

  // Check membership status
  const checkMembership = useCallback(async (skipAutoMint = false) => {
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
        retryCount.current = 0; // Reset retry counter
      } else if (freemiumBalance > 0n) {
        console.log(`User ${userAddress} has freemium membership`)
        setStatus("freemium")
        retryCount.current = 0; // Reset retry counter
      } else {
        console.log(`User ${userAddress} has no membership`)
        setStatus("none")
        
        // AUTO-MINT: If no membership detected and we're not skipping auto-mint
        if (!skipAutoMint && 
            retryCount.current < MAX_AUTO_MINT_RETRIES && 
            !mintingAddresses.has(userAddress)) {
          
          console.log(`Auto-mint attempt ${retryCount.current + 1}/${MAX_AUTO_MINT_RETRIES}`)
          autoMintAttempted.current = true;
          retryCount.current++;
          
          // Use setTimeout to ensure state updates before minting
          setTimeout(() => mintFreemium(true), 0);
        }
      }
    } catch (error) {
      console.error("Error checking membership:", error)
      setStatus("error")
    }
  }, [userAddress])

  // Mint freemium token
  const mintFreemium = useCallback(async (isAutoMint = false) => {
    if (!userAddress) {
      setMintResult({
        success: false,
        error: "No wallet address provided",
      })
      return
    }
    
    // Prevent multiple minting attempts for the same address
    if (mintingAddresses.has(userAddress)) {
      console.log(`Minting already in progress for ${userAddress}`)
      return;
    }

    setMinting(true)
    setMintResult(null)
    mintingAddresses.add(userAddress);

    try {
      console.log(`Minting freemium token for ${userAddress} (${isAutoMint ? 'auto' : 'manual'})`)
      
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
        
        // Only show toast for manual mints (not auto-mints)
        if (!isAutoMint) {
          toast({
            title: data.alreadyMinted ? "Membership Verified" : "Membership Activated",
            description: data.alreadyMinted 
              ? "You already have free membership access" 
              : "Your free membership has been activated!",
          })
        }
        
        // Reset retry counter on success
        retryCount.current = 0;
      } else {
        console.error("Mint error:", data)
        setMintResult({
          success: false,
          error: data.error || "Failed to mint freemium token",
        })
        
        // Only show toast for manual mints
        if (!isAutoMint) {
          toast({
            title: "Membership Error",
            description: data.error || "Failed to activate your membership",
            variant: "destructive",
          })
        }
        
        // AUTO-RETRY: If auto-mint failed and we haven't exceeded retries
        if (isAutoMint && retryCount.current < MAX_AUTO_MINT_RETRIES) {
          console.log(`Scheduling retry ${retryCount.current}/${MAX_AUTO_MINT_RETRIES} in ${RETRY_DELAY_MS}ms`)
          setTimeout(() => checkMembership(false), RETRY_DELAY_MS);
        }
      }
    } catch (error: any) {
      console.error("Error minting freemium:", error)
      setMintResult({
        success: false,
        error: error.message || "An unexpected error occurred",
      })
      
      // Only show toast for manual mints
      if (!isAutoMint) {
        toast({
          title: "Error",
          description: "Failed to process your membership request",
          variant: "destructive",
        })
      }
      
      // AUTO-RETRY: If auto-mint failed and we haven't exceeded retries
      if (isAutoMint && retryCount.current < MAX_AUTO_MINT_RETRIES) {
        console.log(`Scheduling retry ${retryCount.current}/${MAX_AUTO_MINT_RETRIES} in ${RETRY_DELAY_MS}ms`)
        setTimeout(() => checkMembership(false), RETRY_DELAY_MS);
      }
    } finally {
      setMinting(false)
      mintingAddresses.delete(userAddress);
      
      // Verify the mint was successful by checking membership again
      // but skip auto-mint to prevent infinite loops
      setTimeout(() => checkMembership(true), 1000);
    }
  }, [userAddress, toast, checkMembership])

  // Automatically check membership on mount and when wallet changes
  useEffect(() => {
    if (userAddress) {
      // Reset tracking variables when wallet changes
      autoMintAttempted.current = false;
      retryCount.current = 0;
      checkMembership();
    } else {
      setStatus("none");
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
