"use client";

import {
  useActiveAccount,
  useDisconnect,
} from "thirdweb/react";
import { useState } from "react";

export function WalletSummary() {
  const account = useActiveAccount();
  const disconnect = useDisconnect(); // v5: useDisconnect returns a function, not an object

  const [copied, setCopied] = useState(false);

  if (!account) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div
      className="flex flex-col items-start space-y-3"
      style={{ fontFamily: "Adonis, 'Georgia Pro', serif" }}
    >
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-600">
          Membership ID:
        </span>
        <span className="text-sm font-mono">
          {shortenAddress(account.address)}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          style={{ fontFamily: "'Georgia Pro', serif" }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <button
        onClick={disconnect}
        className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors text-sm"
        style={{ fontFamily: "'Georgia Pro', serif" }}
      >
        Sign Out
      </button>
    </div>
  );
}
