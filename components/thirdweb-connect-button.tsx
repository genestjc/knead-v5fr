"use client"

import { ConnectButton } from "thirdweb/react"
import { inAppWallet, createWallet } from "thirdweb/wallets"
import { client } from "@/thirdweb-client"
import { base } from "thirdweb/chains"

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
  return (
    <div className={className}>
      <ConnectButton
        client={client}
        chain={base}
        connectModal={{ size }}
        theme={theme}
        wallets={wallets}
        showThirdwebBranding={false}
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
