"use client"

import { ConnectButton } from "thirdweb/react"
import { client } from "@/thirdweb-client"
import { WalletSummary } from "./wallet-summary"
import { useActiveAccount } from "thirdweb/react"

export function ThirdWebConnectButton() {
  const account = useActiveAccount()

  if (account) {
    return <WalletSummary />
  }

  return (
    <ConnectButton
      client={client}
      theme="light"
      connectButton={{
        label: "Sign In",
        style: {
          backgroundColor: "#000000",
          color: "#ffffff",
          border: "none",
          borderRadius: "12px",
          padding: "2px 8px",
          fontFamily: "'Georgia Pro', serif",
          fontSize: "10px",
          cursor: "pointer",
          minWidth: "45px",
          height: "20px",
          fontWeight: "400",
        },
      }}
      connectModal={{
        size: "compact",
        title: "Sign In to Knead",
        titleIcon: "",
      }}
    />
  )
}
