"use client"

import type React from "react"

import { ThirdwebProvider } from "thirdweb/react"

interface WalletProviderProps {
  children: React.ReactNode
}

export function WalletProvider({ children }: WalletProviderProps) {
  return <ThirdwebProvider>{children}</ThirdwebProvider>
}
