"use client";

import type React from "react";
import { ThirdwebProvider } from "thirdweb/react";
import { client } from "@/thirdweb-client";

interface WalletProviderProps {
  children: React.ReactNode;
}

export function WalletProvider({
  children,
}: WalletProviderProps) {
  return (
    <ThirdwebProvider client={client}>
      {children}
    </ThirdwebProvider>
  );
}
