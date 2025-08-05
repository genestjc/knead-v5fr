"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import { useActiveAccount } from "thirdweb/react";
import { createThirdwebClient, getContract } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { balanceOf as erc721BalanceOf } from "thirdweb/extensions/erc721";
import { base } from "thirdweb/chains";
import { useToast } from "@/hooks/use-toast";

export type MembershipType = "premium" | "freemium" | null;

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

// Membership contract addresses
const MEMBERSHIP_CONTRACTS = {
  KNEAD: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as string,
  ANNUAL_2025: "0xa4b1aF8cffEE71D71721cB69596c9A31ac449F13", 
  SHIFT_MEAL: "0xa4b1aF8cffEE71D71721cB69596c9A31ac449F13", // Same as ANNUAL_2025
  BREADWINNERS_CLUB: "0x0e70AB324E8761E97f131Eecc4Dd63dFDE33cB72"
};

interface MembershipContextType {
  membershipType: MembershipType;
  isLoading: boolean;
  walletAddress: string | undefined;
  refreshMembership: () => Promise<void>;
  hasAccess: (type: MembershipType) => boolean;
  error: string | null;
  isPremium: boolean;
  isFreemium: boolean;
}

const MembershipContext = createContext<
  MembershipContextType | undefined
>(undefined);

// Cache membership checks with expiry
const membershipCache = new Map<string, { type: MembershipType, timestamp: number }>();
const CACHE_DURATION = 60 * 1000; // 1 minute

async function getMembershipType(walletAddress: string): Promise<MembershipType> {
  // Check cache first
  const cached = membershipCache.get(walletAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.type;
  }

  try {
    // Check main Knead membership contract
    const kneadContract = getContract({
      client,
      chain: base,
      address: MEMBERSHIP_CONTRACTS.KNEAD,
    });

    // Check premium token (ID: 1)
    const premiumBalance = await balanceOf({
      contract: kneadContract,
      owner: walletAddress,
      tokenId: 1n,
    });

    if (premiumBalance > 0n) {
      const result = "premium" as MembershipType;
      membershipCache.set(walletAddress, { type: result, timestamp: Date.now() });
      return result;
    }
    
    // Check other premium membership contracts
    
    // Annual/Shift Meal
    const annualContract = getContract({
      client,
      chain: base,
      address: MEMBERSHIP_CONTRACTS.ANNUAL_2025,
    });
    
    const annualBalance = await balanceOf({
      contract: annualContract,
      owner: walletAddress,
      tokenId: 1n, // Annual token ID
    });
    
    const shiftBalance = await balanceOf({
      contract: annualContract,
      owner: walletAddress,
      tokenId: 2n, // Shift meal token ID
    });
    
    if (annualBalance > 0n || shiftBalance > 0n) {
      const result = "premium" as MembershipType;
      membershipCache.set(walletAddress, { type: result, timestamp: Date.now() });
      return result;
    }
    
    // Breadwinner's Club (ERC721)
    const bwcContract = getContract({
      client,
      chain: base,
      address: MEMBERSHIP_CONTRACTS.BREADWINNERS_CLUB,
    });
    
    const bwcBalance = await erc721BalanceOf({
      contract: bwcContract,
      owner: walletAddress,
    });
    
    if (bwcBalance > 0n) {
      const result = "premium" as MembershipType;
      membershipCache.set(walletAddress, { type: result, timestamp: Date.now() });
      return result;
    }

    // Check freemium token (ID: 0)
    const freemiumBalance = await balanceOf({
      contract: kneadContract,
      owner: walletAddress,
      tokenId: 0n,
    });

    if (freemiumBalance > 0n) {
      const result = "freemium" as MembershipType;
      membershipCache.set(walletAddress, { type: result, timestamp: Date.now() });
      return result;
    }

    membershipCache.set(walletAddress, { type: null, timestamp: Date.now() });
    return null;
  } catch (error) {
    console.error("Error checking membership:", error);
    throw error;
  }
}

export function MembershipProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = useActiveAccount();
  const [membershipType, setMembershipType] = useState<MembershipType>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMintingFreemium, setIsMintingFreemium] = useState(false);
  const { toast } = useToast();

  const refreshMembership = async () => {
    if (!account?.address) {
      setMembershipType(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const type = await getMembershipType(account.address);
      setMembershipType(type);
      
      // If no membership, mint freemium token
      if (type === null && !isMintingFreemium) {
        await mintFreemiumToken(account.address);
      }
    } catch (err) {
      console.error("Failed to check membership:", err);
      setError("Failed to verify your membership status");
    } finally {
      setIsLoading(false);
    }
  };
  
  const mintFreemiumToken = async (walletAddress: string) => {
    if (isMintingFreemium) return;
    
    setIsMintingFreemium(true);
    
    try {
      const response = await fetch("/api/onboard-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      
      const result = await response.json();
      
      if (response.ok && (result.success || result.alreadyMinted)) {
        setMembershipType("freemium");
        
        if (!result.alreadyMinted) {
          toast({
            title: "Welcome to Knead!",
            description: "Your free membership has been activated.",
          });
        }
      } else {
        throw new Error(result.error || "Failed to mint freemium token");
      }
    } catch (error) {
      console.error("Error minting freemium token:", error);
      toast({
        title: "Membership Error",
        description: "We couldn't activate your free membership. Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setIsMintingFreemium(false);
    }
  };

  useEffect(() => {
    refreshMembership();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  const hasAccess = useMemo(() => {
    return (type: MembershipType) => {
      if (type === "premium")
        return membershipType === "premium";
      if (type === "freemium")
        return (
          membershipType === "premium" ||
          membershipType === "freemium"
        );
      return false;
    };
  }, [membershipType]);
  
  const isPremium = membershipType === "premium";
  const isFreemium = membershipType === "freemium" || isPremium;

  const contextValue = useMemo(() => ({
    membershipType,
    isLoading: isLoading || isMintingFreemium,
    walletAddress: account?.address,
    refreshMembership,
    hasAccess,
    error,
    isPremium,
    isFreemium
  }), [membershipType, isLoading, account?.address, hasAccess, error, isPremium, isFreemium, isMintingFreemium]);

  return (
    <MembershipContext.Provider value={contextValue}>
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembership() {
  const context = useContext(MembershipContext);
  if (!context)
    throw new Error(
      "useMembership must be used within a MembershipProvider",
    );
  return context;
}
