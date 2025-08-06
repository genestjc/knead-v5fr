"use client";

import { useActiveAccount, useDisconnect } from "thirdweb/react";
import { useState, useRef, useEffect } from "react";
import { Copy, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function WalletSummary() {
  const account = useActiveAccount();
  const { disconnect, isDisconnecting } = useDisconnect();
  const [copied, setCopied] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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
    try {
      if (!account) return;
      
      // Perform local cleanup first
      localStorage.removeItem(`email_${account.address}`);
      
      // Set UI state to show disconnecting
      setIsDropdownOpen(false);
      
      try {
        // Use ThirdWeb disconnect with a timeout
        const disconnectPromise = disconnect();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Disconnect timeout")), 2000)
        );
        
        await Promise.race([disconnectPromise, timeoutPromise]);
        
        toast({
          title: "Signed out successfully",
          description: "You have been signed out of your account",
        });
      } catch (disconnectError) {
        console.error("Disconnect error:", disconnectError);
        // Fall back to manual reload
        window.location.reload();
      }
    } catch (error) {
      console.error("Sign out error:", error);
      toast({
        title: "Sign out issue",
        description: "There was a problem signing out. Please try again.",
        variant: "destructive",
      });
      // Force reload as last resort
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Clean up connected state on unmount
  useEffect(() => {
    return () => {
      // This helps ensure clean disconnect when component unmounts
      if (account) {
        disconnect().catch(console.error);
      }
    };
  }, [account, disconnect]);

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
              disabled={isDisconnecting}
              className="flex items-center w-full px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-100 transition-colors"
              style={{
                opacity: isDisconnecting ? 0.6 : 1,
                cursor: isDisconnecting ? "not-allowed" : "pointer",
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {isDisconnecting ? "Signing Out..." : "Sign Out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
