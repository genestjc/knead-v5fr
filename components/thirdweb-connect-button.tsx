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
          display: "inline-block",
          outline: "none",
          cursor: "pointer",
          fontWeight: 500,
          borderRadius: "4px",
          padding: "0 16px",
          color: "#fff",
          background: "#000",
          lineHeight: 1.15,
          fontSize: "14px",
          height: "36px",
          wordSpacing: "0px",
          letterSpacing: ".0892857143em",
          textDecoration: "none",
          minWidth: "120px",
          border: "none",
          textAlign: "center",
          fontFamily: "'Georgia Pro', serif",
          boxShadow:
            "0px 3px 1px -2px rgb(0 0 0 / 20%), 0px 2px 2px 0px rgb(0 0 0 / 14%), 0px 1px 5px 0px rgb(0 0 0 / 12%)",
          transition:
            "box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1), background 0.2s, color 0.2s",
        },
        hoverStyle: {
          background: "#222", // Slightly lighter black for hover
          boxShadow:
            "0px 2px 4px -1px rgb(0 0 0 / 20%), 0px 4px 5px 0px rgb(0 0 0 / 14%), 0px 1px 10px 0px rgb(0 0 0 / 12%)",
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
