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

  // ✅ FIXED: Check membership - BLOCKCHAIN FIRST (source of truth)
  const checkMembershipFromContract = async (address: string): Promise<MembershipType> => {
    try {
      console.log("Checking membership from contract for:", address);
      
      // FIRST: Check blockchain (source of truth)
      // This checks ALL membership contracts (Monthly, Annual, Breadwinner's Club, etc.)
      const membership = await getMembershipType(client, address);
      console.log("Blockchain membership result:", membership);
      
      // If they have premium on blockchain, verify it's not cancelled in database
      if (membership === "premium") {
        try {
          const response = await fetch(`/api/check-membership?address=${address}`);
          const data = await response.json();
          
          // If subscription is explicitly cancelled in DB, revoke access
          if (response.ok && data.status === "cancelled") {
            console.log("⚠️ Subscription cancelled in database - revoking premium access");
            return null;
          }
          
          // Otherwise, blockchain says premium, so they're premium
          console.log("✅ Premium membership confirmed (blockchain + DB check passed)");
          return "premium";
        } catch (apiError) {
          // API failed, but blockchain says premium, so trust blockchain
          console.warn("⚠️ API check failed, trusting blockchain:", apiError);
          return "premium";
        }
      }
      
      // For non-premium (freemium or null), return blockchain result directly
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
      console.log("✅ Cached membership:", type);
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
        // Use cache immediately
        setMembershipType(cachedMembership.type);
        setIsLoading(false);
        
        // Background: verify cache is still valid via blockchain check
        // This ensures if they just purchased, we'll detect it
        checkMembershipFromContract(address)
          .then(freshMembership => {
            // If blockchain says different than cache, update
            if (freshMembership !== cachedMembership.type) {
              console.log("🔄 Cache outdated, updating from blockchain:", freshMembership);
              localStorage.removeItem(MEMBERSHIP_CACHE_KEY);
              cacheMembership(address, freshMembership);
              setMembershipType(freshMembership);
            }
          })
          .catch(err => console.error("Background blockchain check failed:", err));
        
        return;
      }
      
      // No cached data, fetch directly from blockchain
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
      console.log("🔄 Refreshing membership - clearing cache");
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
