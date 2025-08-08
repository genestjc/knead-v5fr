"use client"

import { useEffect } from "react"
import { ConnectButton, useActiveAccount } from "thirdweb/react"
import { inAppWallet, createWallet } from "thirdweb/wallets"
import { client } from "@/thirdweb-client"
import { usePersistentWallet } from "@/hooks/use-persistent-wallet"
import { useToast } from "@/hooks/use-toast"

const wallets = [
  inAppWallet({
    auth: {
      options: ["email", "google", "apple", "coinbase", "passkey", "phone", "discord", "telegram", "farcaster", "x"],
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
  // Get the active account to detect connection
  const activeAccount = useActiveAccount()
  const { toast } = useToast()

  // Call the onboarding API when a wallet connects
  useEffect(() => {
    // Only proceed if we have a connected wallet
    if (activeAccount?.address) {
      console.log("Wallet connected, onboarding user:", activeAccount.address);
      
      // Call the onboarding API to mint the freemium NFT
      fetch("/api/onboard-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: activeAccount.address,
        }),
      })
      .then(response => response.json())
      .then(data => {
        console.log("Onboarding response:", data);
        if (data.success) {
          // Show a welcome message
          toast({
            title: data.alreadyMinted ? "Welcome back!" : "Welcome to Knead!",
            description: data.alreadyMinted 
              ? "You're already a member." 
              : "You've been given free access to 3 articles per month.",
          });
        } else {
          console.error("Onboarding error:", data);
        }
      })
      .catch(err => {
        console.error("Error onboarding user:", err);
      });
    }
  }, [activeAccount?.address, toast]);

  return (
    <div className={className}>
      <ConnectButton
        client={client}
        connectModal={{ size }}
        theme={theme}
        wallets={wallets}
        connectButton={{
          label: "Sign In",
          style: {
            backgroundColor: "#000",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "4px 20px",
            fontFamily: "adonis-web, serif",
            fontWeight: "300",
            fontSize: "13px",
            cursor: "pointer",
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
    </div>
  )
}
