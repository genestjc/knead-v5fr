"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useToast } from "@/hooks/use-toast";
import { createThirdwebClient } from "thirdweb";
import { getMembershipType } from "@/lib/membership";

// Simplified client for balance checking
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

type MembershipType = "premium" | "freemium" | null;

interface MembershipContextProps {
  walletAddress: string | null;
  membershipType: MembershipType;
  isLoading: boolean;
  hasAccess: (requiredLevel: "premium" | "freemium") => boolean;
  refreshMembership: () => Promise<void>;
  error: string | null;
}

const MembershipContext = createContext<MembershipContextProps | undefined>(undefined);

// Local storage key for membership cache
const MEMBERSHIP_CACHE_KEY = "knead_membership_cache";

interface CachedMembership {
  type: MembershipType;
  address: string;
  expiresAt: number; // timestamp
}

export function MembershipProvider({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const [membershipType, setMembershipType] = useState<MembershipType>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Check membership directly from the contract using the comprehensive function
  const checkMembershipFromContract = async (address: string): Promise<MembershipType> => {
    try {
      console.log("Checking membership from contract for:", address);
      
      // FIRST: Check if subscription is cancelled in database
      const response = await fetch(`/api/check-membership?address=${address}`);
      const data = await response.json();
      
      // If API says they have no membership or error, don't rely on cache
      if (!response.ok || data.membershipType === "none") {
        return null;
      }
      
      // Use the comprehensive membership checker that checks all contracts
      // including Breadwinner's Club (ERC721 on Zora) and Annual memberships
      const membership = await getMembershipType(client, address);
      
      return membership;
    } catch (err) {
      console.error("Error checking membership from contract:", err);
      // Default to allowing some access rather than blocking on errors
      return "freemium";
    }
  };

  // Check if there's a cached membership and it's still valid
  const getCachedMembership = (address: string): CachedMembership | null => {
    try {
      const cachedData = localStorage.getItem(MEMBERSHIP_CACHE_KEY);
      if (!cachedData) return null;
      
      const cache: CachedMembership = JSON.parse(cachedData);
      
      // Verify it's for the same wallet and not expired (6 hour cache)
      if (cache.address === address && cache.expiresAt > Date.now()) {
        console.log("Using cached membership data:", cache.type);
        return cache;
      }
      return null;
    } catch (err) {
      console.error("Error reading cached membership:", err);
      return null;
    }
  };

  // Cache the membership data
  const cacheMembership = (address: string, type: MembershipType) => {
    try {
      const cacheData: CachedMembership = {
        address,
        type,
        // Cache for 6 hours (reduced from 24 to catch burns faster)
        expiresAt: Date.now() + (6 * 60 * 60 * 1000)
      };
      localStorage.setItem(MEMBERSHIP_CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      console.error("Error caching membership:", err);
    }
  };

  const fetchMembershipType = async (address: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // First try to get cached membership
      const cachedMembership = getCachedMembership(address);
      if (cachedMembership) {
        // Even with cache, verify it's still valid via API (quick check)
        fetch(`/api/check-membership?address=${address}`)
          .then(res => res.json())
          .then(data => {
            // If API says "none" but we have cache, clear cache and refetch
            if (data.membershipType === "none" && cachedMembership.type !== null) {
              console.log("Cache invalidated by API check, refetching...");
              localStorage.removeItem(MEMBERSHIP_CACHE_KEY);
              fetchMembershipType(address);
            }
          })
          .catch(err => console.error("Background API check failed:", err));
        
        setMembershipType(cachedMembership.type);
        setIsLoading(false);
        return;
      }
      
      // No cached data, fetch directly from contract
      const contractMembership = await checkMembershipFromContract(address);
      
      // Cache and set the result
      cacheMembership(address, contractMembership);
      setMembershipType(contractMembership);
      
    } catch (error: any) {
      console.error("Error fetching membership:", error);
      setError("Couldn't verify membership status");
      setMembershipType(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!account?.address) {
      setMembershipType(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    fetchMembershipType(account.address);
  }, [account?.address]);

  const hasAccess = (requiredLevel: "premium" | "freemium"): boolean => {
    try {
      if (!account?.address) {
        return false;
      }
      
      // Only allow during loading if the error isn't set
      if (isLoading && !error) {
        return true; // Grant temporary access while loading
      }
      
      // Premium membership validation is performed once on component mount (via useEffect).
      // Do not add API calls here as hasAccess() may be called frequently during renders.
      if (requiredLevel === "premium") {
        return membershipType === "premium";
      }
      
      // For freemium, either freemium or premium access is sufficient
      return membershipType === "freemium" || membershipType === "premium";
    } catch (error) {
      console.error("Error checking access:", error);
      return false;
    }
  };

  const refreshMembership = async () => {
    if (account?.address) {
      // Clear cache before refreshing
      localStorage.removeItem(MEMBERSHIP_CACHE_KEY);
      await fetchMembershipType(account.address);
    }
  };

  const value = {
    walletAddress: account?.address || null,
    membershipType,
    isLoading,
    hasAccess,
    refreshMembership,
    error,
  };

  return (
    <MembershipContext.Provider value={value}>
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembership() {
  const context = useContext(MembershipContext);
  if (context === undefined) {
    throw new Error("useMembership must be used within a MembershipProvider");
  }
  return context;
}
