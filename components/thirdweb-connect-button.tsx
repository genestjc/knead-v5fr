"use client";

import { ConnectButton } from "thirdweb/react";
import {
  inAppWallet,
  createWallet,
} from "thirdweb/wallets";
import { client } from "@/thirdweb-client";

const wallets = [
  inAppWallet({
    auth: {
      options: [
        "email",
        "google",
        "apple",
        "coinbase",
        "passkey",
        "phone",
        "discord",
        "telegram",
        "farcaster",
        "x",
      ],
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
];

interface ThirdWebConnectButtonProps {
  className?: string;
  theme?: "light" | "dark";
  size?: "compact" | "wide";
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
        // Hide wallet details for all wallet types
        detailsButton={false}
      />
    </div>
  );
}
