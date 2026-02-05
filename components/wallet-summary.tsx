"use client";

import { useActiveAccount, useDisconnect } from "thirdweb/react";
import { useState, useRef, useEffect } from "react";
import { Copy, LogOut, DollarSign, Key, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getContract } from "thirdweb";
import { transfer } from "thirdweb/extensions/erc20";
import { toWei } from "thirdweb";
import { client, activeChain } from "@/thirdweb-client";
import { useActiveWallet } from "thirdweb/react";

interface WalletSummaryProps {
  context?: "default" | "chat";
  onExportClick?: () => void; // Callback to show export modal
  onExternalWalletExport?: () => void; // Callback for external wallet message
}

export function WalletSummary({ 
  context = "default",
  onExportClick,
  onExternalWalletExport 
}: WalletSummaryProps) {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const disconnect = useDisconnect();
  const [copied, setCopied] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [townsBalance, setTownsBalance] = useState<string>("0");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Check if wallet is in-app wallet
  const isInAppWallet = wallet?.walletId === "inApp" || wallet?.id === "inApp";
  const isChatContext = context === "chat";

  // Fetch $TOWNS balance if in chat context
  useEffect(() => {
    if (!isChatContext || !account?.address) return;

    const fetchBalance = async () => {
      try {
        const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
        if (!townsContractAddress) return;

        const contract = getContract({
          client,
          chain: activeChain,
          address: townsContractAddress,
        });

        // You'll need to import and use the balanceOf function from thirdweb
        // For now, this is a placeholder
        // const balance = await balanceOf({ contract, address: account.address });
        // setTownsBalance(formatUnits(balance, 18));
        
        // Placeholder until you add the balanceOf call
        setTownsBalance("1,234");
      } catch (error) {
        console.error("Failed to fetch TOWNS balance:", error);
      }
    };

    fetchBalance();
  }, [account?.address, isChatContext]);

  const handleCopy = async () => {
    if (!account?.address) return;
    try {
      await navigator.clipboard.writeText(account.address);
      setCopied(true);
      toast({
        title: "Address copied!",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleWithdraw = async () => {
    if (!wallet) {
      toast({
        title: "No wallet connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    setIsDropdownOpen(false);

    const withdrawAmount = prompt('How many $TOWNS tokens do you want to withdraw?');
    if (!withdrawAmount) return;

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    const destinationAddress = prompt(
      'Enter destination wallet address:\n' +
      '(e.g., your Coinbase wallet address)'
    );
    
    if (!destinationAddress) return;

    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(destinationAddress)) {
      toast({
        title: "Invalid address",
        description: "Please enter a valid Ethereum address",
        variant: "destructive",
      });
      return;
    }

    try {
      const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
      if (!townsContractAddress) {
        throw new Error('TOWNS contract address not configured');
      }

      const contract = getContract({
        client,
        chain: activeChain,
        address: townsContractAddress,
      });

      const tx = transfer({
        contract,
        to: destinationAddress,
        amount: toWei(amount.toString()),
      });

      console.log('🔄 Sending withdrawal transaction...');
      const receipt = await wallet.sendTransaction({ transaction: tx });
      
      toast({
        title: "Withdrawal successful!",
        description: `${amount} $TOWNS sent to ${destinationAddress.slice(0, 6)}...${destinationAddress.slice(-4)}`,
      });

      console.log(`Transaction: https://basescan.org/tx/${receipt.transactionHash}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Withdrawal error:', error);
      toast({
        title: "Withdrawal failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleExportKey = () => {
    setIsDropdownOpen(false);
    
    // Check if external wallet
    if (!isInAppWallet) {
      onExternalWalletExport?.();
      return;
    }

    // Show export instructions for in-app wallet
    onExportClick?.();
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    
    try {
      setIsSigningOut(true);
      setIsDropdownOpen(false);
      
      try {
        await disconnect();
        console.log("ThirdWeb disconnect successful");
      } catch (disconnectError) {
        console.log("Ignoring known ThirdWeb disconnect error", disconnectError);
      }
      
      localStorage.removeItem("knead_membership_cache");
      
      const thirdwebKeys = Object.keys(localStorage).filter(key => 
        key.includes('thirdweb') || 
        key.includes('walletconnect') || 
        key.startsWith('email_') ||
        key.startsWith('tw-') ||
        key.includes('wallet')
      );
      
      console.log('Clearing the following localStorage keys:', thirdwebKeys);
      thirdwebKeys.forEach(key => localStorage.removeItem(key));
      
      const sessionKeys = Object.keys(sessionStorage).filter(key => 
        key.includes('thirdweb') || 
        key.includes('walletconnect') || 
        key.startsWith('tw-') ||
        key.includes('wallet')
      );
      
      sessionKeys.forEach(key => sessionStorage.removeItem(key));
      
      document.cookie.split(";").forEach(cookie => {
        const [name] = cookie.trim().split("=");
        if (name.includes("thirdweb") || name.includes("wallet")) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
        }
      });
      
      setTimeout(() => {
        window.location.href = '/?nocache=' + new Date().getTime();
      }, 500);
    } catch (error) {
      console.error("Failed to sign out:", error);
      window.location.href = '/?forcereload=' + new Date().getTime();
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
        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {/* Copy Address */}
            <button
              onClick={handleCopy}
              className="flex items-center w-full px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied ? "Copied!" : "Copy Address"}
            </button>

            {/* ✅ Chat-only features */}
            {isChatContext && (
              <>
                <div className="border-t border-gray-100 my-1"></div>
                
                {/* TOWNS Balance */}
                <div className="px-4 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm font-adonis text-gray-700">
                      <Wallet className="w-4 h-4 mr-2" />
                      $TOWNS Balance
                    </div>
                    <span className="text-sm font-adonis font-semibold text-gray-900">
                      {townsBalance}
                    </span>
                  </div>
                </div>

                {/* Withdraw Earnings */}
                <button
                  onClick={handleWithdraw}
                  className="flex items-center w-full px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Withdraw Earnings
                </button>

                {/* Export Private Key */}
                <button
                  onClick={handleExportKey}
                  className="flex items-center w-full px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Key className="w-4 h-4 mr-2" />
                  Export Private Key
                </button>
              </>
            )}

            <div className="border-t border-gray-100 my-1"></div>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center w-full px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {isSigningOut ? "Signing Out..." : "Sign Out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
