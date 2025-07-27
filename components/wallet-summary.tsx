"use client";

import {
  useActiveAccount,
  useDisconnect,
} from "thirdweb/react";
import { useState, useRef, useEffect } from "react";
import { Copy, LogOut } from "lucide-react";

export function WalletSummary() {
  const account = useActiveAccount();
  const { disconnect, isLoading } = useDisconnect();
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
    if (isLoading) return;
    try {
      await disconnect();
      setIsDropdownOpen(false);
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  const shortenAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );
    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
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
        <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={handleCopy}
              className="flex items-center w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors"
              style={{
                fontFamily: "Adonis, 'Georgia Pro', serif",
              }}
            >
              <Copy className="w-3 h-3 mr-2" />
              {copied ? "Copied!" : "Copy Membership"}
            </button>
            <div className="border-t border-gray-100 my-1"></div>
            <button
              onClick={handleSignOut}
              disabled={isLoading}
              className="flex items-center w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
              style={{
                fontFamily: "Adonis, 'Georgia Pro', serif",
              }}
            >
              <LogOut className="w-3 h-3 mr-2" />
              {isLoading ? "Signing Out..." : "Sign Out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
