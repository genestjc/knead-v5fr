"use client";

import { ConnectButton } from "thirdweb/react";
import { client } from "@/thirdweb-client";
import { WalletSummary } from "./wallet-summary";
import { useActiveAccount } from "thirdweb/react";

export function ThirdWebConnectButton() {
  const account = useActiveAccount();

  if (account) {
    return <WalletSummary />;
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
          borderRadius: "10px",
          padding: "1px 6px",
          fontFamily: "'Georgia Pro', serif",
          fontSize: "8px",
          cursor: "pointer",
          minWidth: "30px",
          height: "16px",
          fontWeight: "400",
          lineHeight: "1",
        },
      }}
      connectModal={{
        size: "compact",
        title: "Sign In to Knead",
        titleIcon: "",
      }}
    />
  );
}
