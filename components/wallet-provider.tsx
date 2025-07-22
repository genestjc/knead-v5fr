"use client";

import type React from "react";
import { ThirdwebProvider } from "thirdweb/react";
import { client } from "@/thirdweb-client";
import {
  inAppWallet,
  createWallet,
} from "thirdweb/wallets";

const wallets = [
  inAppWallet({
    auth: {
      options: [
        "email",
        "phone",
        "passkey",
        "google",
        "apple",
        "coinbase",
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

interface WalletProviderProps {
  children: React.ReactNode;
}

export function WalletProvider({
  children,
}: WalletProviderProps) {
  return (
    <ThirdwebProvider
      client={client}
      supportedWallets={wallets}
    >
      {children}
    </ThirdwebProvider>
  );
}
