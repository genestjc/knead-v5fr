"use client"

import { useState, useCallback, useEffect } from "react"
import { createThirdwebClient } from "thirdweb"
import { getMembershipType } from "@/lib/membership"

// Membership status types
type MembershipStatus = "loading" | "none" | "freemium" | "premium" | "error"

// Create client
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || 
    (process.env.NODE_ENV !== "production" ? "44984f2bc038cebc6138d4ceb602c35d" : undefined),
})

/**
 * ✅ SIMPLIFIED: Read-only membership status hook
 * 
 * NO LONGER auto-mints freemium NFTs (that's handled by thirdweb-connect-button)
 * Just checks membership status from blockchain
 * 
 * Removed:
 * - Auto-mint retry logic
 * - mintFreemium() function
 * - Polling/retry state management
 */
export function useFreemiumMembership(userAddress: string | null) {
  const [status, setStatus] = useState<MembershipStatus>("loading")

  // Check membership status (read-only, no minting)
  const checkMembership = useCallback(async () => {
    if (!userAddress) {
      setStatus("none")
      return
    }

    try {
      setStatus("loading")
      console.log(`[use-freemium-membership] Checking membership for ${userAddress}`)

      // Use comprehensive membership checker that checks ALL contracts
      const membershipType = await getMembershipType(client, userAddress)

      // Determine membership type
      if (membershipType === "premium") {
        console.log(`[use-freemium-membership] User has premium membership`)
        setStatus("premium")
      } else if (membershipType === "freemium") {
        console.log(`[use-freemium-membership] User has freemium membership`)
        setStatus("freemium")
      } else {
        console.log(`[use-freemium-membership] No membership detected`)
        setStatus("none")
        // ✅ REMOVED: Auto-mint logic - now handled by thirdweb-connect-button
      }
    } catch (error) {
      console.error("[use-freemium-membership] Error checking membership:", error)
      setStatus("error")
    }
  }, [userAddress])

  // Automatically check membership on mount and when wallet changes
  useEffect(() => {
    if (userAddress) {
      checkMembership();
    } else {
      setStatus("none");
    }
  }, [userAddress, checkMembership])

  return {
    status,
    checkMembership,
    // ✅ REMOVED: minting, mintFreemium, mintResult
    // These are no longer needed - freemium minting happens in thirdweb-connect-button
    minting: false, // Keep for backward compatibility
  }
}
