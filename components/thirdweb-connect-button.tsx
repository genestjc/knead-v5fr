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
          fontSize: "16px",
          lineHeight: "20px",
          fontWeight: 600,
          borderRadius: "8px",
          padding: "14px 24px",
          border: "none",
          transition:
            "box-shadow 0.2s ease 0s, -ms-transform 0.1s ease 0s, -webkit-transform 0.1s ease 0s, transform 0.1s ease 0s",
          background:
            "linear-gradient(to right, rgb(230, 30, 77) 0%, rgb(227, 28, 95) 50%, rgb(215, 4, 102) 100%)",
          color: "#fff",
          fontFamily: "'Georgia Pro', serif",
          minWidth: "120px",
          textAlign: "center",
          textDecoration: "none",
          letterSpacing: ".089em",
          boxShadow:
            "0px 3px 1px -2px rgb(0 0 0 / 20%), 0px 2px 2px 0px rgb(0 0 0 / 14%), 0px 1px 5px 0px rgb(0 0 0 / 12%)",
          textTransform: "uppercase",
        },
        hoverStyle: {
          background:
            "linear-gradient(to right, rgb(215, 4, 102) 0%, rgb(227, 28, 95) 50%, rgb(230, 30, 77) 100%)",
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
