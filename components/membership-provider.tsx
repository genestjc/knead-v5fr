"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useToast } from "@/hooks/use-toast";

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

  // Check if there's a cached membership and it's still valid
  const getCachedMembership = (address: string): CachedMembership | null => {
    try {
      const cachedData = localStorage.getItem(MEMBERSHIP_CACHE_KEY);
      if (!cachedData) return null;
      
      const cache: CachedMembership = JSON.parse(cachedData);
      
      // Verify it's for the same wallet and not expired (24 hour cache)
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
        // Cache for 24 hours
        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
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
        setMembershipType(cachedMembership.type);
        setIsLoading(false);
        return;
      }
      
      // If no cache, call API with retries
      const fetchWithRetries = async (retries = 3): Promise<MembershipType> => {
        try {
          const response = await fetch(`/api/check-membership?address=${address}`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch membership: ${response.status}`);
          }
          
          const data = await response.json();
          return data.membershipType;
        } catch (err) {
          if (retries > 0) {
            // Wait a bit before retrying (exponential backoff)
            await new Promise(r => setTimeout(r, 1000 * (3 - retries + 1)));
            return fetchWithRetries(retries - 1);
          }
          throw err;
        }
      };
      
      // Try to fetch with retries
      const membershipResult = await fetchWithRetries();
      
      // Cache the result
      cacheMembership(address, membershipResult);
      setMembershipType(membershipResult);
      
    } catch (error: any) {
      console.error("Error fetching membership:", error);
      
      setError("Couldn't verify membership status");
      
      // Default to freemium when errors occur (better user experience)
      // This is a temporary fallback until verification succeeds
      setMembershipType("freemium");
      
      toast({
        title: "Membership Status",
        description: "Using free membership while we verify your status",
      });
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
      if (isLoading) return true; // Grant temporary access while loading
      if (!account?.address) return false;
      
      if (requiredLevel === "premium") {
        return membershipType === "premium";
      }
      
      // For freemium, either freemium or premium access is sufficient
      return membershipType === "freemium" || membershipType === "premium";
    } catch (error) {
      console.error("Error checking access:", error);
      
      // Default to allowing freemium access on errors
      return requiredLevel === "freemium";
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
