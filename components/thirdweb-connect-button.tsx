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
          borderRadius: "16px",
          padding: "4px 10px",
          fontFamily: "'Georgia Pro', serif",
          fontSize: "11px",
          cursor: "pointer",
          minWidth: "60px",
          height: "24px",
          fontWeight: "400",
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
