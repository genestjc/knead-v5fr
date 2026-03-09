"use client"

import { useEffect, useState, useRef } from "react"
import { ConnectButton, useActiveAccount } from "thirdweb/react"
import { inAppWallet, createWallet } from "thirdweb/wallets"
import { client } from "@/thirdweb-client"
import { base } from "thirdweb/chains"
import { useToast } from "@/hooks/use-toast"

const wallets = [
  inAppWallet({
    auth: {
      options: ["email", "google", "apple", "coinbase", "passkey", "phone", "discord", "telegram", "farcaster", "x"],
      mode: "redirect",
      redirectUrl: typeof window !== "undefined" ? window.location.href : undefined,
    },
    hidePrivateKeyExport: false,
    executionMode: {
      mode: "EIP7702",
      sponsorGas: true,
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
]

interface ThirdWebConnectButtonProps {
  className?: string
  theme?: "light" | "dark"
  size?: "compact" | "wide"
}

export function ThirdWebConnectButton({
  className = "",
  theme = "light",
  size = "compact",
}: ThirdWebConnectButtonProps) {
  const activeAccount = useActiveAccount()
  const { toast } = useToast()
  const [isOnboarding, setIsOnboarding] = useState(false)
  const [onboardingError, setOnboardingError] = useState<string | null>(null)
  
  // ✅ Track which addresses we've already onboarded (prevents infinite loop)
  const onboardedAddresses = useRef<Set<string>>(new Set())

  useEffect(() => {
    // ✅ FIXED: Only run once per unique address
    if (!activeAccount?.address) return;
    
    const address = activeAccount.address.toLowerCase();
    
    // Skip if we've already onboarded this address
    if (onboardedAddresses.current.has(address)) {
      console.log(`[onboard] Skipping - already onboarded ${address}`);
      return;
    }
    
    // Mark as onboarding
    onboardedAddresses.current.add(address);
    setIsOnboarding(true);
    setOnboardingError(null);
    
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
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log("[onboard] Response:", data);
      if (data.success) {
        toast({
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
        onboardedAddresses.current.delete(address);
        setOnboardingError(data.error || "Failed to onboard");
        toast({
          title: "Onboarding Error",
          description: data.error || "Failed to complete onboarding. Please refresh and try again.",
          variant: "destructive",
        });
      }
    })
    .catch(err => {
      console.error("[onboard] Error:", err);
      // Remove from set so we can retry
      onboardedAddresses.current.delete(address);
      setOnboardingError(err.message || "Network error");
      toast({
        title: "Connection Error",
        description: "Failed to complete onboarding. Please refresh and try again.",
        variant: "destructive",
      });
    })
    .finally(() => {
      setIsOnboarding(false);
    });
  }, [activeAccount?.address, toast]); // ✅ REMOVED isOnboarding from dependencies

  return (
    <div className={className}>
      <ConnectButton
        client={client}
        chain={base}
        connectModal={{ size }}
        theme={theme}
        wallets={wallets}
        showThirdwebBranding={false} // ✅ NEW: Removes "Powered by thirdweb" footer
        connectButton={{
          label: isOnboarding ? "Processing..." : "Sign In",
          style: {
            backgroundColor: "#000",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "4px 20px",
            fontFamily: "adonis-web, serif",
            fontWeight: "300",
            fontSize: "13px",
            cursor: isOnboarding ? "default" : "pointer",
            opacity: isOnboarding ? 0.7 : 1,
            minWidth: "90px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            transition: "all 0.2s ease",
          },
        }}
        detailsButton={{
          style: {
            backgroundColor: "#fff",
            color: "#000",
            border: "1px solid #e5e5e5",
            borderRadius: "8px",
            padding: "6px 14px",
            fontFamily: "adonis-web, serif",
            fontWeight: "300",
            fontSize: "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            transition: "all 0.2s ease",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          },
        }}
      />
      {onboardingError && (
        <div className="text-red-500 text-xs mt-1">
          {onboardingError}
        </div>
      )}
    </div>
  )
}
