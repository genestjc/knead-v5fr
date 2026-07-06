"use client"

import { useEffect, useRef } from "react"
import { useActiveAccount } from "thirdweb/react"
import { memberFetch } from "@/lib/auth/member-fetch"

// Track which addresses we've already onboarded (prevents infinite loop)
const onboardedAddresses = new Set<string>();

export function OnboardingHandler() {
  const activeAccount = useActiveAccount()

  useEffect(() => {
    // Only run once per unique address
    if (!activeAccount?.address) {
      console.log("[onboard] No active account yet");
      return;
    }
    
    const address = activeAccount.address.toLowerCase();
    
    // Skip if we've already onboarded this address
    if (onboardedAddresses.has(address)) {
      console.log(`[onboard] Skipping - already onboarded ${address}`);
      return;
    }
    
    // Mark as onboarding
    onboardedAddresses.add(address);
    
    console.log("[onboard] Starting onboarding for:", address);
    
    memberFetch("/api/onboard-user", activeAccount, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        walletAddress: activeAccount.address,
      }),
    })
    .then(response => {
      console.log("[onboard] API response status:", response.status);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log("[onboard] Response:", data);
      
      if (data.transactionHash) {
        console.log(`[onboard] Transaction: https://basescan.org/tx/${data.transactionHash}`);
      }
      
      if (!data.success) {
        console.error("[onboard] API returned success: false", data);
        // Remove from set so we can retry
        onboardedAddresses.delete(address);
      }
    })
    .catch(err => {
      console.error("[onboard] Error:", err);
      // Remove from set so we can retry
      onboardedAddresses.delete(address);
    })
    .finally(() => {
      console.log("[onboard] Onboarding complete");
    });
  }, [activeAccount?.address]);

  // This component doesn't render anything
  return null;
}
