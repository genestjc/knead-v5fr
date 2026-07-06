"use client"

import { useEffect } from "react"
import { useActiveAccount, useActiveWallet } from "thirdweb/react"
import { memberFetch } from "@/lib/auth/member-fetch"

// Track which addresses we've already onboarded (prevents infinite loop)
const onboardedAddresses = new Set<string>();

type WalletWithAuthToken = {
  id?: string;
  walletId?: string;
  getAuthToken?: () => string | null | Promise<string | null>;
};

function isInAppWallet(wallet?: WalletWithAuthToken): boolean {
  return (
    wallet?.id === "inApp" ||
    wallet?.id === "embedded" ||
    wallet?.walletId === "inApp" ||
    wallet?.walletId === "embedded"
  );
}

export function OnboardingHandler() {
  const activeAccount = useActiveAccount()
  const activeWallet = useActiveWallet() as WalletWithAuthToken | undefined

  useEffect(() => {
    // Only run once per unique address
    if (!activeAccount?.address) {
      console.log("[onboard] No active account yet");
      return;
    }
    if (!activeWallet) {
      console.log("[onboard] No active wallet yet");
      return;
    }
    
    const address = activeAccount.address.toLowerCase();
    
    // Skip if we've already onboarded this address
    if (onboardedAddresses.has(address)) {
      console.log(`[onboard] Skipping - already onboarded ${address}`);
      return;
    }

    if (!isInAppWallet(activeWallet)) {
      console.log("[onboard] Skipping passive onboarding for external wallet");
      onboardedAddresses.add(address);
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
    }, activeWallet, { allowSignatureFallback: false })
    .then(response => {
      console.log("[onboard] API response status:", response.status);
      if (response.status === 401) {
        console.log("[onboard] Waiting for silent embedded-wallet session");
        return null;
      }
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (!data) return;
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
  }, [activeAccount, activeAccount?.address, activeWallet]);

  // This component doesn't render anything
  return null;
}
