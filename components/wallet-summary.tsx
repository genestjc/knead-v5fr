"use client";

import {
  useActiveAccount,
  useDisconnect,
} from "thirdweb/react";
import { useState, useRef, useEffect } from "react";
import { Copy, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function WalletSummary() {
  const account = useActiveAccount();
  const { disconnect, isDisconnecting } = useDisconnect();
  const [copied, setCopied] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
    if (isSigningOut) return; // Prevent multiple clicks
    
    try {
      setIsSigningOut(true);
      setIsDropdownOpen(false);
      
      // Clear any local storage data first
      if (account?.address) {
        localStorage.removeItem(`email_${account.address}`);
      }
      
      try {
        // Wrap disconnect in a timeout to prevent UI freeze
        const disconnectPromise = new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              if (account) {
                await disconnect();
              }
              resolve();
            } catch (err: any) {
              // Known ThirdWeb error - ignore it
              if (err?.message?.includes("reading 'id'") || 
                  err?.message?.includes("Cannot read properties of undefined")) {
                console.log("Ignoring known ThirdWeb disconnect error");
              } else {
                console.error("Unknown disconnect error:", err);
              }
              resolve();
            }
          }, 100);
        });
        
        // Add a timeout to prevent hanging
        await Promise.race([
          disconnectPromise,
          new Promise(resolve => setTimeout(resolve, 1500))
        ]);
        
        // Toast and reload to ensure clean state
        toast({
          title: "Signed Out",
          description: "You have been signed out successfully",
        });
      } catch (err) {
        console.error("Disconnect error:", err);
      }
      
      // Force reload with a delay
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("Failed to sign out:", error);
      // Still reload as a fallback
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
        className="text-sm font-adonis text-black hover:text-gray-600 transition-colors cursor-pointer"
      >
        {shortenAddress(account.address)}
      </button>
      {isDropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={handleCopy}
              className="flex items-center w-full px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied ? "Copied!" : "Copy Membership"}
            </button>
            <div className="border-t border-gray-100 my-1"></div>
            <button
              onClick={handleSignOut}
              disabled={isDisconnecting || isSigningOut}
              className="flex items-center w-full px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {isDisconnecting || isSigningOut ? "Signing Out..." : "Sign Out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
