"use client"

import { useEffect, useRef } from "react"
import { useActiveAccount } from "thirdweb/react"
import { useToast } from "@/hooks/use-toast"

// Track which addresses we've already onboarded (prevents infinite loop)
const onboardedAddresses = new Set<string>();

export function OnboardingHandler() {
  const activeAccount = useActiveAccount()
  const { toast } = useToast()
  const toastRef = useRef(toast)
  
  // Update toast ref when it changes (without triggering effect)
  useEffect(() => {
    toastRef.current = toast
  }, [toast])

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
    
    fetch("/api/onboard-user", {
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
      if (data.success) {
        toastRef.current({
          title: data.alreadyMinted ? "Welcome back!" : "Welcome to Knead!",
          description: data.alreadyMinted 
            ? "You're already a member." 
            : "You've been given free access to 3 articles per month.",
        });
        
        if (data.transactionHash) {
          console.log(`[onboard] Transaction: https://basescan.org/tx/${data.transactionHash}`);
        }
      } else {
        console.error("[onboard] API returned success: false", data);
        // Remove from set so we can retry
        onboardedAddresses.delete(address);
        toastRef.current({
          title: "Onboarding Error",
          description: data.error || "Failed to complete onboarding. Please refresh and try again.",
          variant: "destructive",
        });
      }
    })
    .catch(err => {
      console.error("[onboard] Error:", err);
      // Remove from set so we can retry
      onboardedAddresses.delete(address);
      toastRef.current({
        title: "Connection Error",
        description: "Failed to complete onboarding. Please refresh and try again.",
        variant: "destructive",
      });
    })
    .finally(() => {
      console.log("[onboard] Onboarding complete");
    });
  }, [activeAccount?.address]);

  // This component doesn't render anything
  return null;
}
