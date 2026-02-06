"use client";

import { useActiveAccount, useDisconnect, useWalletDetailsModal } from "thirdweb/react";
import { useState, useRef, useEffect } from "react";
import { Copy, LogOut, Send, Key, Wallet, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getContract, prepareContractCall, sendTransaction } from "thirdweb"; // ✅ Fixed imports
import { transfer } from "thirdweb/extensions/erc20";
import { toWei } from "thirdweb/utils"; // ✅ Fixed import path
import { getWalletBalance } from "thirdweb/wallets"; // ✅ NEW: Use getWalletBalance instead
import { client, activeChain } from "@/thirdweb-client";
import { useActiveWallet } from "thirdweb/react";
import { motion, AnimatePresence } from "framer-motion";

interface WalletSummaryProps {
  context?: "default" | "chat";
}

export function WalletSummary({ 
  context = "default",
}: WalletSummaryProps) {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const disconnect = useDisconnect();
  const detailsModal = useWalletDetailsModal();
  const [copied, setCopied] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [townsBalance, setTownsBalance] = useState<string>("0");
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  
  const [showExternalWalletMessage, setShowExternalWalletMessage] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const isInAppWallet = wallet?.walletId === "inApp" || wallet?.id === "inApp";
  const isChatContext = context === "chat";

  // ✅ FIXED: Fetch balance using getWalletBalance
  useEffect(() => {
    if (!isChatContext || !account?.address) return;

    const fetchBalance = async () => {
      setIsLoadingBalance(true);
      try {
        const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
        if (!townsContractAddress) {
          console.warn("TOWNS contract address not configured");
          setTownsBalance("0");
          return;
        }

        console.log('🔍 Fetching TOWNS balance for:', account.address);
        console.log('🔍 Contract:', townsContractAddress);

        // ✅ Use getWalletBalance instead of balanceOf + formatUnits
        const balance = await getWalletBalance({
          address: account.address,
          client,
          chain: activeChain,
          tokenAddress: townsContractAddress,
        });

        // ✅ balance.displayValue is already formatted!
        const displayBalance = parseFloat(balance.displayValue).toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
        
        setTownsBalance(displayBalance);
        console.log(`✅ TOWNS Balance: ${displayBalance} ${balance.symbol}`);
      } catch (error) {
        console.error("Failed to fetch TOWNS balance:", error);
        setTownsBalance("0");
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
    
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
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

  const handleWithdrawClick = () => {
    if (!wallet) {
      toast({
        title: "No wallet connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    setIsDropdownOpen(false);
    setShowWithdrawalModal(true);
    setWithdrawAmount("");
    setDestinationAddress("");
    setWithdrawError(null);
  };

  // ✅ FIXED: Use sendTransaction from thirdweb (not wallet.sendTransaction)
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);

    if (!wallet || !account) {
      setWithdrawError("No wallet connected");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError("Please enter a valid amount greater than 0");
      return;
    }

    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(destinationAddress)) {
      setWithdrawError("Please enter a valid Ethereum address (0x followed by 40 hex characters)");
      return;
    }

    setIsWithdrawing(true);

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

      // ✅ Prepare the transaction
      const transaction = transfer({
        contract,
        to: destinationAddress,
        amount: toWei(amount.toString()),
      });

      console.log('🔄 Sending withdrawal transaction...');
      
      // ✅ Use sendTransaction from thirdweb (not wallet.sendTransaction)
      const result = await sendTransaction({
        account,
        transaction,
      });
      
      toast({
        title: "Transaction successful!",
        description: `${amount} $TOWNS sent to ${destinationAddress.slice(0, 6)}...${destinationAddress.slice(-4)}`,
      });

      console.log(`✅ Transaction: https://basescan.org/tx/${result.transactionHash}`);
      
      setShowWithdrawalModal(false);
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Withdrawal error:', error);
      setWithdrawError(errorMessage);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleExportKey = () => {
    setIsDropdownOpen(false);
    
    if (!isInAppWallet) {
      setShowExternalWalletMessage(true);
      return;
    }

    detailsModal.open({ 
      client,
      theme: "light"
    });
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
    <>
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
              <button
                onClick={handleCopy}
                className="flex items-center w-full px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Copy className="w-4 h-4 mr-2" />
                {copied ? "Copied!" : "Copy Address"}
              </button>

              {isChatContext && (
                <>
                  <div className="border-t border-gray-100 my-1"></div>
                  
                  <div className="px-4 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm font-adonis text-gray-700">
                        <Wallet className="w-4 h-4 mr-2" />
                        $TOWNS Balance
                      </div>
                      <span className="text-sm font-adonis font-semibold text-gray-900">
                        {isLoadingBalance ? "..." : townsBalance}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleWithdrawClick}
                    className="flex items-center w-full px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send $TOWNS To Wallet
                  </button>

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

      {/* Withdrawal Modal */}
      <AnimatePresence>
        {showWithdrawalModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl"
            >
              <div className="text-center mb-6">
                <h1 className="font-adonis text-4xl mb-2">Knead</h1>
                <p className="font-georgia-pro text-sm text-gray-600">Send Your $TOWNS</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="font-adonis text-sm text-gray-700">Available Balance:</span>
                  <span className="font-adonis text-xl font-semibold text-gray-900">
                    {townsBalance} $TOWNS
                  </span>
                </div>
              </div>

              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-adonis text-sm text-amber-900 mb-1">Important</h3>
                    <p className="font-georgia-pro text-xs text-amber-800">
                      Make sure you're sending to a wallet you control. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleWithdrawSubmit}>
                <div className="mb-4">
                  <label className="block font-adonis text-sm text-gray-700 mb-2">
                    Amount to Send
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-georgia-pro text-sm"
                      disabled={isWithdrawing}
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-adonis text-sm text-gray-500">
                      $TOWNS
                    </span>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block font-adonis text-sm text-gray-700 mb-2">
                    Destination Address
                  </label>
                  <input
                    type="text"
                    value={destinationAddress}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-georgia-pro text-sm"
                    disabled={isWithdrawing}
                    required
                  />
                  <p className="font-georgia-pro text-xs text-gray-500 mt-1">
                    Enter a valid Ethereum wallet address
                  </p>
                </div>

                {withdrawError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-georgia-pro text-sm text-red-700">{withdrawError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowWithdrawalModal(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-full font-georgia-pro text-sm hover:bg-gray-200 transition"
                    disabled={isWithdrawing}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-black text-white rounded-full font-georgia-pro text-sm hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isWithdrawing}
                  >
                    {isWithdrawing ? "Processing..." : "Withdraw"}
                  </button>
                </div>
              </form>

              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg">🔒</span>
                  <p className="font-georgia-pro text-xs text-green-800">
                    Your funds are secured by smart contracts on Base. Transactions are processed on-chain.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* External Wallet Message Modal */}
      <AnimatePresence>
        {showExternalWalletMessage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl"
            >
              <div className="text-center mb-6">
                <span className="text-6xl">🔐</span>
              </div>

              <h2 className="font-adonis text-2xl text-center mb-4">External Wallet Detected</h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="font-georgia-pro text-sm text-gray-700">
                  You're using <strong>MetaMask, Coinbase, or another external wallet</strong>.
                </p>
                <p className="font-georgia-pro text-sm text-gray-700 mt-3">
                  For security, your private key is managed by your wallet app and is <strong>never accessible to this site</strong>.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-adonis text-sm font-semibold mb-2">To export your private key:</h3>
                <ol className="font-georgia-pro text-sm text-gray-700 space-y-1 list-decimal list-inside">
                  <li>Open your wallet app (MetaMask, Coinbase, etc.)</li>
                  <li>Go to Settings → Security</li>
                  <li>Select "Show Private Key" or "Export Private Key"</li>
                </ol>
              </div>

              <button
                onClick={() => setShowExternalWalletMessage(false)}
                className="w-full px-4 py-3 bg-black text-white rounded-full font-georgia-pro text-sm hover:bg-gray-800 transition"
              >
                Got It
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
