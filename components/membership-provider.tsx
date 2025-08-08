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
      console.log("Fetching membership type for:", address);
      
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
          console.log(`Attempt ${3-retries+1}/3: Calling check-membership API...`);
          const response = await fetch(`/api/check-membership?address=${address}`);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`API returned error: ${response.status}`, errorText);
            throw new Error(`Failed to fetch membership: ${response.status}`);
          }
          
          const data = await response.json();
          console.log("Membership API response:", data);
          
          if (!data.membershipType) {
            throw new Error("No membership type returned");
          }
          
          return data.membershipType;
        } catch (err) {
          if (retries > 0) {
            console.log(`Retrying membership check (${retries} attempts left)`);
            // Wait a bit before retrying (exponential backoff)
            await new Promise(r => setTimeout(r, 1000 * (3 - retries + 1)));
            return fetchWithRetries(retries - 1);
          }
          throw err;
        }
      };
      
      // Try to fetch with retries
      const membershipResult = await fetchWithRetries();
      console.log(`Membership result determined: ${membershipResult}`);
      
      // Cache the result
      cacheMembership(address, membershipResult);
      setMembershipType(membershipResult);
      
    } catch (error: any) {
      console.error("Error fetching membership:", error);
      
      setError("Couldn't verify membership status");
      
      // On error, default to null (we'll handle gracefully in hasAccess)
      setMembershipType(null);
      
      toast({
        title: "Membership Status Error",
        description: "We couldn't verify your membership status. Please refresh.",
        variant: "destructive"
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

    console.log("Account changed, fetching membership for:", account.address);
    fetchMembershipType(account.address);
  }, [account?.address]);

  const hasAccess = (requiredLevel: "premium" | "freemium"): boolean => {
    try {
      if (!account?.address) {
        console.log("hasAccess: No account connected");
        return false;
      }
      
      // Only allow during loading if the error isn't set
      if (isLoading && !error) {
        console.log("hasAccess: Still loading, temporarily allowing access");
        return true; // Grant temporary access while loading
      }
      
      console.log(`hasAccess check: Required=${requiredLevel}, Current=${membershipType}`);
      
      if (requiredLevel === "premium") {
        return membershipType === "premium";
      }
      
      // For freemium, either freemium or premium access is sufficient
      return membershipType === "freemium" || membershipType === "premium";
    } catch (error) {
      console.error("Error checking access:", error);
      
      // Default to denying access on errors
      return false;
    }
  };

  const refreshMembership = async () => {
    if (account?.address) {
      // Clear cache before refreshing
      localStorage.removeItem(MEMBERSHIP_CACHE_KEY);
      console.log("Manually refreshing membership data");
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
