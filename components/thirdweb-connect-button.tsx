import {
  useActiveAccount,
  useDisconnect,
  useConnect,
} from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { client } from "@/thirdweb-client";

const socialOptions = [
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
];

export function ThirdWebConnectButton({ className = "" }) {
  const account = useActiveAccount();
  const { disconnect } = useDisconnect();
  const { connect, isConnecting } = useConnect();

  if (!account) {
    return (
      <button
        className={className}
        style={{
          fontFamily: "Adonis Heads, serif",
          fontWeight: 700,
          fontSize: "16px",
          background: "#000",
          color: "#fff",
          borderRadius: "8px",
          padding: "8px 24px",
        }}
        onClick={() =>
          connect(
            inAppWallet({
              auth: { options: socialOptions },
            }),
          )
        }
        disabled={isConnecting}
      >
        Sign In
      </button>
    );
  }

  return (
    <div className={className}>
      <span
        style={{
          fontFamily: "Georgia Pro, serif",
          fontWeight: 400,
          fontSize: "15px",
        }}
      >
        Signed in as: {account.address}
      </span>
      <button
        onClick={disconnect}
        style={{
          fontFamily: "Adonis Heads, serif",
          fontWeight: 700,
          fontSize: "16px",
          background: "#000",
          color: "#fff",
          borderRadius: "8px",
          padding: "8px 24px",
          marginLeft: "16px",
        }}
      >
        Sign Out
      </button>
    </div>
  );
}
