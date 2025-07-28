"use client";

import { ConnectButton } from "thirdweb/react";
import { client } from "@/thirdweb-client";

export function ThirdWebConnectButton() {
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
          borderRadius: "32px",
          padding: "10px 28px",
          fontFamily: "'Georgia Pro', serif",
          fontSize: "16px",
          cursor: "pointer",
          minWidth: "120px",
          height: "44px",
          fontWeight: "500",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          transition: "background 0.2s, color 0.2s",
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
