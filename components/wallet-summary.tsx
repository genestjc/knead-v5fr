"use client";

import { useActiveAccount, useDisconnect, useWalletDetailsModal } from "thirdweb/react";
import { useState, useRef, useEffect } from "react";
import { Copy, LogOut, ArrowUpFromLine, Key, Wallet, AlertTriangle, DollarSign, Download, Settings, Zap, HelpCircle, Award, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getContract, sendTransaction, prepareContractCall, readContract } from "thirdweb";
import { transfer } from "thirdweb/extensions/erc20";
import { getWalletBalance } from "thirdweb/wallets";
import { client, activeChain } from "@/thirdweb-client";
import { useActiveWallet } from "thirdweb/react";
import { motion, AnimatePresence } from "framer-motion";
import { ContributorSettingsModal } from "@/components/chat/ContributorSettingsModal";
import { getContributorStats, getParticipantStats, getContractConstants } from "@/lib/blockchain/contract-reads";

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
  
  const [isContributor, setIsContributor] = useState(false);
  const [claimableBalance, setClaimableBalance] = useState<string>("0");
  const [isLoadingClaimable, setIsLoadingClaimable] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  
  const [weeklyAllowance, setWeeklyAllowance] = useState<string>("0");
  const [weeklyAllowanceCap, setWeeklyAllowanceCap] = useState<string>("1");
  const [isLoadingAllowance, setIsLoadingAllowance] = useState(false);
  
  const [totalEarned, setTotalEarned] = useState<string>("0");
  const [graduationThreshold, setGraduationThreshold] = useState<string>("3334");
  const [hasGraduated, setHasGraduated] = useState(false);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(false);
  
  const [showContributorSettings, setShowContributorSettings] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [contractAddresses, setContractAddresses] = useState<{
    rewardsAddress?: string;
    usdcAddress?: string;
  } | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const isInAppWallet = wallet?.walletId === "inApp" || wallet?.id === "inApp";
  const isChatContext = context === "chat";

  useEffect(() => {
    console.log('🔍 WalletSummary mounted');
    console.log('🔍 Context:', context);
    console.log('🔍 isChatContext:', isChatContext);
    console.log('🔍 Account:', account?.address);
  }, []);

  // Fetch contract addresses from server at runtime (not build time)
  useEffect(() => {
    fetch('/api/config/contracts')
      .then(res => res.json())
      .then(data => setContractAddresses(data))
      .catch(err => console.error('Failed to fetch contract addresses:', err));
  }, []);

  useEffect(() => {
    console.log('🔍 Contributor check useEffect triggered');
    console.log('🔍 Account address:', account?.address);
    
    if (!account?.address) {
      console.log('❌ No account address, setting isContributor to false');
      setIsContributor(false);
      return;
    }
    
    const checkContributorStatus = async () => {
      try {
        console.log('🔍 Starting contributor status check...');
        
        const nftContractAddress = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
        
        console.log('🔍 NFT Contract Address from env:', nftContractAddress);
        
        if (!nftContractAddress) {
          console.warn('❌ Contributor NFT contract address not configured in .env.local');
          console.warn('❌ Add: NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS=0xYourContractAddress');
          return;
        }
        
        console.log('✅ Creating NFT contract instance...');
        
        const nftContract = getContract({
          client,
          chain: activeChain,
          address: nftContractAddress,
        });
        
        console.log('✅ NFT Contract created');
        
        const contributorTokenIds = [1, 2, 3];
        
        console.log('🔍 Checking token IDs:', contributorTokenIds);
        
        for (const tokenId of contributorTokenIds) {
          console.log(`🔍 Checking token ID ${tokenId}...`);
          
          const balance = await readContract({
            contract: nftContract,
            method: 'function balanceOf(address owner, uint256 id) view returns (uint256)',
            params: [account.address, BigInt(tokenId)],
          });
          
          console.log(`🔍 Token ${tokenId} balance:`, balance.toString());
          
          if (balance > 0n) {
            console.log(`✅ User owns Contributor NFT #${tokenId}!`);
            console.log('✅ Setting isContributor to TRUE');
            setIsContributor(true);
            return;
          }
        }
        
        console.log('❌ User does not own any contributor NFTs');
        setIsContributor(false);
      } catch (error) {
        console.error('❌ Failed to check contributor status:', error);
        console.error('❌ Error details:', error);
        setIsContributor(false);
      }
    };
    
    checkContributorStatus();
  }, [account?.address]);

  useEffect(() => {
    console.log('🔍 isContributor state changed to:', isContributor);
  }, [isContributor]);

  useEffect(() => {
    if (!account?.address || !isChatContext) return;
    
    const fetchUserData = async () => {
      try {
        const response = await fetch(`/api/chat/user?address=${account.address}`);
        const data = await response.json();
        if (data.success) {
          setUserData(data.user);
          console.log('✅ User data loaded:', data.user);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };
    
    fetchUserData();
  }, [account?.address, isChatContext]);

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

        const balance = await getWalletBalance({
          address: account.address,
          client,
          chain: activeChain,
          tokenAddress: townsContractAddress,
        });
        
        const displayBalance = parseFloat(balance.displayValue).toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
        
        setTownsBalance(displayBalance);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        setTownsBalance("0");
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
    
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [account?.address, isChatContext]);

  useEffect(() => {
    if (!isChatContext) return;
    
    const fetchConstants = async () => {
      try {
        const constants = await getContractConstants();
        setGraduationThreshold(constants.graduationThreshold.toFixed(0));
        setWeeklyAllowanceCap(constants.weeklyAllowance.toFixed(0));
        console.log('✅ Contract constants loaded:', constants);
      } catch (error) {
        console.error('Failed to fetch contract constants:', error);
      }
    };
    
    fetchConstants();
  }, [isChatContext]);

  useEffect(() => {
    if (!isContributor || !account?.address || !isChatContext) return;
    
    const fetchContributorStats = async () => {
      setIsLoadingAllowance(true);
      try {
        const stats = await getContributorStats(account.address);
        setWeeklyAllowance(stats.lockedAllowance.toFixed(0));
        console.log('✅ Contributor stats loaded:', stats);
      } catch (error) {
        console.error('Failed to fetch contributor stats:', error);
        setWeeklyAllowance('0');
      } finally {
        setIsLoadingAllowance(false);
      }
    };
    
    fetchContributorStats();
    const interval = setInterval(fetchContributorStats, 30000);
    return () => clearInterval(interval);
  }, [isContributor, account?.address, isChatContext]);

  useEffect(() => {
    if (!account?.address || !isChatContext) return;
    
    const fetchParticipantStats = async () => {
      setIsLoadingEarnings(true);
      try {
        const stats = await getParticipantStats(account.address);
        setTotalEarned(stats.totalEarned.toFixed(2));
        setHasGraduated(stats.graduated);
        console.log('✅ Participant stats loaded:', stats);
      } catch (error) {
        console.error('Failed to fetch participant stats:', error);
        setTotalEarned('0');
      } finally {
        setIsLoadingEarnings(false);
      }
    };
    
    fetchParticipantStats();
    const interval = setInterval(fetchParticipantStats, 30000);
    return () => clearInterval(interval);
  }, [account?.address, isChatContext]);

  useEffect(() => {
    console.log('🔍 Claimable balance useEffect triggered');
    console.log('🔍 isContributor:', isContributor);
    console.log('🔍 isChatContext:', isChatContext);
    
    if (!isContributor || !account?.address || !isChatContext) {
      console.log('❌ Not fetching claimable balance - requirements not met');
      return;
    }
    
    console.log('✅ Fetching claimable balance...');
    
    const fetchClaimableBalance = async () => {
      setIsLoadingClaimable(true);
      try {
        const stats = await getContributorStats(account.address);
        const displayClaimable = stats.cashbackEarnings.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
        setClaimableBalance(displayClaimable);
        console.log(`✅ Claimable balance: $${displayClaimable}`);
      } catch (error) {
        console.error('❌ Failed to fetch claimable balance:', error);
        setClaimableBalance('0');
      } finally {
        setIsLoadingClaimable(false);
      }
    };
    
    fetchClaimableBalance();
    const interval = setInterval(fetchClaimableBalance, 30000);
    return () => clearInterval(interval);
  }, [isContributor, account?.address, isChatContext]);

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

  const handleClaimTowns = async () => {
    if (!account) return;
    
    const claimableNum = parseFloat(claimableBalance.replace(/,/g, ''));
    if (claimableNum <= 0) {
      toast({
        title: "Nothing to claim",
        description: "You don't have any USDC to claim yet",
        variant: "destructive",
      });
      return;
    }
    
    setIsClaiming(true);
    setIsDropdownOpen(false);
    
    try {
      // Use runtime-fetched address instead of build-time env var
      const rewardsContractAddress = contractAddresses?.rewardsAddress;
      if (!rewardsContractAddress) throw new Error('Rewards contract not loaded. Please refresh.');
      
      const rewardsContract = getContract({
        client,
        chain: activeChain,
        address: rewardsContractAddress,
      });
      
      const transaction = prepareContractCall({
        contract: rewardsContract,
        method: 'function claimTowns()',
        params: [],
      });
      
      const result = await sendTransaction({
        account,
        transaction,
      });
      
      toast({
        title: "USDC claimed!",
        description: `Successfully claimed $${claimableBalance}`,
      });
      
      console.log(`✅ Claim TX: https://basescan.org/tx/${result.transactionHash}`);
      
      setClaimableBalance('0');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Claim error:', error);
      toast({
        title: "Claim failed",
        description: error.message || 'Failed to claim USDC',
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
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

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);

    if (!wallet || !account) {
      setWithdrawError("No wallet connected");
      return;
    }

    const amountString = withdrawAmount.replace(/,/g, "").trim();
    
    const amount = parseFloat(amountString);
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
        throw new Error('Contract address not configured');
      }

      const contract = getContract({
        client,
        chain: activeChain,
        address: townsContractAddress,
      });

      const balanceNum = parseFloat(townsBalance.replace(/,/g, ""));
      if (balanceNum < amount) {
        setWithdrawError(`Insufficient balance. You have $${townsBalance} but are trying to send $${amountString}.`);
        setIsWithdrawing(false);
        return;
      }

      const transaction = transfer({
        contract,
        to: destinationAddress,
        amount: amountString,
      });
      
      const result = await sendTransaction({
        account,
        transaction,
      });
      
      toast({
        title: "Transfer successful!",
        description: `$${amount} sent to ${destinationAddress.slice(0, 6)}...${destinationAddress.slice(-4)}`,
      });

      console.log(`✅ Transaction: https://basescan.org/tx/${result.transactionHash}`);
      
      setShowWithdrawalModal(false);
      
      setTimeout(async () => {
        try {
          const balance = await getWalletBalance({
            address: account.address,
            client,
            chain: activeChain,
            tokenAddress: townsContractAddress,
          });
          
          const displayBalance = parseFloat(balance.displayValue).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          });
          
          setTownsBalance(displayBalance);
        } catch (error) {
          console.error("Failed to refresh balance:", error);
        }
      }, 2000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Withdrawal error:', error);
      setWithdrawError(errorMessage);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleContributorSettings = () => {
    setIsDropdownOpen(false);
    setShowContributorSettings(true);
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
      
      console.log('🧹 Clearing authentication...');
      
      // ✅ Clear Towns bearer token (authentication)
      localStorage.removeItem('knead_towns_bearer_token');
      localStorage.removeItem('knead_towns_token_expiry');
      
      // ✅ DON'T clear Towns device encryption keys - they should persist
      console.log('🔐 Preserving Towns device encryption keys for DM continuity');
      
      try {
        await disconnect();
        console.log("ThirdWeb disconnect successful");
      } catch (disconnectError) {
        console.log("Ignoring known ThirdWeb disconnect error", disconnectError);
      }
      
      // ✅ Clear membership cache
      localStorage.removeItem("knead_membership_cache");
      
      // ✅ Clear ThirdWeb wallet keys (but NOT Towns device keys)
      const thirdwebKeys = Object.keys(localStorage).filter(key => {
        // Exclude Towns device/encryption keys - these must persist for DMs
        if (key.includes('towns') || 
            key.includes('@river-build') || 
            key.includes('river_') ||
            key.startsWith('device_') ||
            key.includes('crypto_')) {
          console.log(`🔐 Preserving: ${key}`);
          return false;
        }
        
        // Only clear ThirdWeb-related keys
        return key.includes('thirdweb') || 
               key.includes('walletconnect') || 
               key.startsWith('email_') ||
               key.startsWith('tw-');
      });
      
      thirdwebKeys.forEach(key => {
        console.log(`❌ Removing: ${key}`);
        localStorage.removeItem(key);
      });
      
      const sessionKeys = Object.keys(sessionStorage).filter(key => 
        key.includes('thirdweb') || 
        key.includes('walletconnect') || 
        key.startsWith('tw-')
      );
      
      sessionKeys.forEach(key => sessionStorage.removeItem(key));
      
      // ✅ Clear cookies
      document.cookie.split(";").forEach(cookie => {
        const [name] = cookie.trim().split("=");
        if (name.includes("thirdweb")) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
        }
      });
      
      console.log('✅ Authentication cleared - redirecting...');
      
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
                        Balance
                      </div>
                      <span className="text-sm font-adonis font-semibold text-gray-900">
                        {isLoadingBalance ? "..." : `$${townsBalance}`}
                      </span>
                    </div>
                  </div>

                  {isContributor && (
                    <>
                      <div className="px-4 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm font-adonis text-gray-700">
                            <Zap className="w-4 h-4 mr-2" />
                            Weekly Allowance
                          </div>
                          <span className="text-sm font-adonis font-semibold text-blue-600">
                            {isLoadingAllowance ? "..." : `$${weeklyAllowance} / $${weeklyAllowanceCap}`}
                          </span>
                        </div>
                      </div>

                      <div className="px-4 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm font-adonis text-gray-700">
                            <DollarSign className="w-4 h-4 mr-2" />
                            <span>Claimable</span>
                            <div className="relative group">
                              <HelpCircle className="w-3 h-3 ml-1 text-gray-400 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                <p className="font-semibold mb-1">Contributor Earnings</p>
                                <p>When you tip messages, you receive 20% back in USDC. Your balance accumulates here and can be claimed to your wallet.</p>
                                <p className="mt-1 text-gray-300">Weekly allowance resets Sunday.</p>
                              </div>
                            </div>
                          </div>
                          <span className="text-sm font-adonis font-semibold text-green-600">
                            {isLoadingClaimable ? "..." : `$${claimableBalance}`}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={handleClaimTowns}
                        disabled={isClaiming || parseFloat(claimableBalance.replace(/,/g, '')) <= 0}
                        className="flex items-center w-full px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {isClaiming ? 'Claiming...' : 'Claim USDC'}
                      </button>
                    </>
                  )}

                  {!isContributor && (
                    <>
                      <div className="px-4 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm font-adonis text-gray-700">
                            <Award className="w-4 h-4 mr-2" />
                            Total Earned
                          </div>
                          <span className="text-sm font-adonis font-semibold text-gray-900">
                            {isLoadingEarnings ? "..." : `$${totalEarned}`}
                          </span>
                        </div>
                      </div>

                      {!hasGraduated && (
                        <div className="px-4 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-sm font-adonis text-gray-700">
                              <TrendingUp className="w-4 h-4 mr-2" />
                              Progress
                            </div>
                            <span className="text-sm font-adonis font-semibold text-purple-600">
                              {isLoadingEarnings ? "..." : `$${totalEarned} / $${graduationThreshold}`}
                            </span>
                          </div>
                        </div>
                      )}

                      {hasGraduated && (
                        <div className="px-4 py-2 bg-gradient-to-r from-yellow-50 to-yellow-100">
                          <div className="flex items-center justify-center text-sm font-adonis text-yellow-800">
                            🎓 Graduated!
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    onClick={handleWithdrawClick}
                    className="flex items-center w-full px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <ArrowUpFromLine className="w-4 h-4 mr-2" />
                    Send USDC
                  </button>

                  <div className="border-t border-gray-100 my-1"></div>

                  {isContributor && (
                    <button
                      onClick={handleContributorSettings}
                      className="flex items-center w-full px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Contributor Settings
                    </button>
                  )}

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

      <AnimatePresence>
        {showWithdrawalModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
            onClick={() => setShowWithdrawalModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <h1 className="font-adonis text-4xl mb-2">Knead</h1>
                <p className="font-georgia-pro text-sm text-gray-600">Send Your USDC</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="font-adonis text-sm text-gray-700">Available Balance:</span>
                  <span className="font-adonis text-xl font-semibold text-gray-900">
                    ${townsBalance}
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
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-adonis text-sm text-gray-500">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-georgia-pro text-sm"
                      disabled={isWithdrawing}
                      required
                    />
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
                    {isWithdrawing ? "Sending..." : "Send"}
                  </button>
                </div>
              </form>

              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Wallet className="w-4 h-4 text-green-600 mt-0.5" />
                  <p className="font-georgia-pro text-xs text-green-800">
                    Your funds are secured by smart contracts on Base. Transactions are processed on-chain.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExternalWalletMessage && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
            onClick={() => setShowExternalWalletMessage(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <Key className="w-16 h-16 mx-auto text-gray-700" />
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

      <ContributorSettingsModal
        isOpen={showContributorSettings}
        onClose={() => setShowContributorSettings(false)}
        userAddress={account.address}
        currentAlias={userData?.alias}
        currentAvatar={userData?.avatar}
        currentBio={userData?.bio}
        userId={userData?.id}
        onSaved={(alias, avatar, bio) => {
          setUserData((prev: any) => ({ ...prev, alias, avatar, bio }));
        }}
      />
    </>
  );
}
