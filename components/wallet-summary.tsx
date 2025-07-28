"use client";

import {
  useActiveAccount,
  useDisconnect,
  useActiveWallet,
} from "thirdweb/react";
import { useState, useRef, useEffect } from "react";
import { Copy, LogOut } from "lucide-react";

export function WalletSummary() {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const [copied, setCopied] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] =
    useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    if (!account?.address) return;

    try {
      await navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      if (activeWallet) {
        await disconnect({ wallet: activeWallet });
      } else {
        await disconnect();
      }
      setIsDropdownOpen(false);
      // Optionally clear storage for embedded wallet edge cases
      // localStorage.clear();
      // sessionStorage.clear();
      window.location.reload();
    } catch (error) {
      console.error("Failed to disconnect:", error);
      setIsDropdownOpen(false);
      window.location.reload();
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node)
    ) {
      setIsDropdownOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );
    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, []);

  if (!account) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="text-sm font-mono text-black hover:text-gray-600 transition-colors cursor-pointer"
        style={{
          fontFamily: "Adonis, 'Georgia Pro', serif",
        }}
      >
        {shortenAddress(account.address)}
      </button>
      {isDropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={handleCopy}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              style={{
                fontFamily: "Adonis, 'Georgia Pro', serif",
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied ? "Copied!" : "Copy Membership ID"}
            </button>
            <div className="border-t border-gray-100 my-1"></div>
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              style={{
                fontFamily: "Adonis, 'Georgia Pro', serif",
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
