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
import { base } from "thirdweb/chains";

export type MembershipType = "premium" | "freemium" | null;

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

interface MembershipContextType {
  membershipType: MembershipType;
  isLoading: boolean;
  walletAddress: string | undefined;
  refreshMembership: () => Promise<void>;
  hasAccess: (type: MembershipType) => boolean;
  error: string | null;
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
    const contract = getContract({
      client,
      chain: base,
      address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!,
    });

    // Check premium token (ID: 1)
    const premiumBalance = await balanceOf({
      contract,
      owner: walletAddress,
      tokenId: 1n,
    });

    if (premiumBalance > 0n) {
      const result = "premium" as MembershipType;
      membershipCache.set(walletAddress, { type: result, timestamp: Date.now() });
      return result;
    }

    // Check freemium token (ID: 0)
    const freemiumBalance = await balanceOf({
      contract,
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
    } catch (err) {
      console.error("Failed to check membership:", err);
      setError("Failed to verify your membership status");
    } finally {
      setIsLoading(false);
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

  const contextValue = useMemo(() => ({
    membershipType,
    isLoading,
    walletAddress: account?.address,
    refreshMembership,
    hasAccess,
    error,
  }), [membershipType, isLoading, account?.address, hasAccess, error]);

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
