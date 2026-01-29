"use client"

import { useEffect, useState } from "react"
import { ConnectButton, useActiveAccount } from "thirdweb/react"
import { inAppWallet, createWallet } from "thirdweb/wallets"
import { ethers5Adapter } from "thirdweb/adapters/ethers5"
import { client, activeChain } from "@/thirdweb-client"
import { useToast } from "@/hooks/use-toast"
import { joinSpace } from "@towns-protocol/web3"

const wallets = [
  inAppWallet({
    auth: {
      options: ["email", "google", "apple", "coinbase", "passkey", "phone", "discord", "telegram", "farcaster", "x"],
    },
    hidePrivateKeyExport: false,
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
]

const KNEAD_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!

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
  const [onboardingStep, setOnboardingStep] = useState<string>("")

  useEffect(() => {
    if (activeAccount?.address && !isOnboarding) {
      console.log("🎯 Starting onboarding for:", activeAccount.address);
      setIsOnboarding(true);
      
      (async () => {
        try {
          // Step 1: Fund wallet with gas
          setOnboardingStep("Funding wallet...");
          console.log("💰 Step 1: Funding wallet with gas");
          
          const fundResponse = await fetch("/api/towns/fund-wallet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userAddress: activeAccount.address }),
          });
          const fundData = await fundResponse.json();
          
          if (!fundData.success) {
            throw new Error(fundData.error || "Failed to fund wallet");
          }
          
          console.log("✅ Wallet funded:", fundData.alreadyFunded ? "already had funds" : "funded successfully");

          // Step 2: Mint Knead article NFT
          setOnboardingStep("Minting membership...");
          console.log("🎫 Step 2: Minting Knead article membership");
          
          const onboardResponse = await fetch("/api/onboard-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress: activeAccount.address }),
          });
          const onboardData = await onboardResponse.json();
          
          if (!onboardData.success) {
            throw new Error(onboardData.error || "Failed to mint membership");
          }
          
          console.log("✅ Knead membership:", onboardData.alreadyMinted ? "already owned" : "minted");

          // Step 3: Convert thirdweb account to ethers signer
          setOnboardingStep("Joining community...");
          console.log("🔄 Step 3: Converting account to ethers signer");
          
          const signer = await ethers5Adapter.signer.toEthers({
            client,
            chain: activeChain,
            account: activeAccount,
          });
          
          console.log("✅ Signer created");

          // Step 4: Join Towns space
          console.log("💬 Step 4: Joining Towns space");
          
          await joinSpace({
            signer,
            spaceId: KNEAD_SPACE_ID,
          });
          
          console.log("✅ Towns space joined");

          // Success!
          toast({
            title: onboardData.alreadyMinted ? "Welcome back!" : "Welcome to Knead!",
            description: onboardData.alreadyMinted 
              ? "You're all set - enjoy the community!" 
              : "You now have access to 3 free articles/month and community chat.",
          });
          
          console.log("🎉 Onboarding complete!");

        } catch (error: any) {
          console.error("❌ Onboarding error:", error);
          toast({
            title: "Setup Error",
            description: error.message || "Failed to complete setup. Please refresh and try again.",
            variant: "destructive",
          });
        } finally {
          setIsOnboarding(false);
          setOnboardingStep("");
        }
      })();
    }
  }, [activeAccount?.address, toast, isOnboarding]);

  return (
    <div className={className}>
      <ConnectButton
        client={client}
        connectModal={{ size }}
        theme={theme}
        wallets={wallets}
        connectButton={{
          label: isOnboarding ? onboardingStep || "Processing..." : "Sign In",
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
            minWidth: "120px",
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
