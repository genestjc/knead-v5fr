"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useToast } from "@/hooks/use-toast";
import { createThirdwebClient } from "thirdweb";
import { getMembershipType } from "@/lib/membership";

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

const MEMBERSHIP_CACHE_KEY = "knead_membership_cache";

interface CachedMembership {
  type: MembershipType;
  address: string;
  expiresAt: number;
}

export function MembershipProvider({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const [membershipType, setMembershipType] = useState<MembershipType>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const checkMembershipFromContract = async (address: string): Promise<MembershipType> => {
    try {
      console.log("[membership-provider] Checking membership for:", address);
      
      const membership = await getMembershipType(client, address);
      console.log("[membership-provider] Blockchain result:", membership);
      
      if (membership === "premium") {
        try {
          const response = await fetch(`/api/check-membership?address=${address}`);
          const data = await response.json();
          
          if (response.ok && data.status === "cancelled") {
            console.log("[membership-provider] ⚠️ Subscription cancelled - revoking premium");
            return null;
          }
          
          console.log("[membership-provider] ✅ Premium membership confirmed");
          return "premium";
        } catch (apiError) {
          console.warn("[membership-provider] ⚠️ API check failed, trusting blockchain:", apiError);
          return "premium";
        }
      }
      
      return membership;
    } catch (err) {
      console.error("[membership-provider] Error checking membership:", err);
      return "freemium";
    }
  };

  const getCachedMembership = (address: string): CachedMembership | null => {
    try {
      const cachedData = localStorage.getItem(MEMBERSHIP_CACHE_KEY);
      if (!cachedData) return null;
      
      const cache: CachedMembership = JSON.parse(cachedData);
      
      if (cache.address === address && cache.expiresAt > Date.now()) {
        console.log("[membership-provider] Using cached membership:", cache.type);
        return cache;
      }
      return null;
    } catch (err) {
      console.error("[membership-provider] Error reading cache:", err);
      return null;
    }
  };

  const cacheMembership = (address: string, type: MembershipType) => {
    try {
      // ✅ NEW: Shorter cache for non-premium users (they might upgrade soon)
      const cacheDuration = type === 'premium' 
        ? 6 * 60 * 60 * 1000  // 6 hours for premium (stable)
        : 5 * 60 * 1000;      // 5 minutes for freemium/null (might upgrade)
      
      const cacheData: CachedMembership = {
        address,
        type,
        expiresAt: Date.now() + cacheDuration
      };
      localStorage.setItem(MEMBERSHIP_CACHE_KEY, JSON.stringify(cacheData));
      console.log(`[membership-provider] ✅ Cached ${type} for ${cacheDuration / 1000}s`);
    } catch (err) {
      console.error("[membership-provider] Error caching:", err);
    }
  };

  const fetchMembershipType = async (address: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const cachedMembership = getCachedMembership(address);
      if (cachedMembership) {
        setMembershipType(cachedMembership.type);
        setIsLoading(false);
        
        // Background verification (check if cache is stale)
        checkMembershipFromContract(address)
          .then(freshMembership => {
            if (freshMembership !== cachedMembership.type) {
              console.log("[membership-provider] 🔄 Cache outdated, updating:", freshMembership);
              localStorage.removeItem(MEMBERSHIP_CACHE_KEY);
              cacheMembership(address, freshMembership);
              setMembershipType(freshMembership);
            }
          })
          .catch(err => console.error("[membership-provider] Background check failed:", err));
        
        return;
      }
      
      // No cache, fetch from blockchain
      const contractMembership = await checkMembershipFromContract(address);
      cacheMembership(address, contractMembership);
      setMembershipType(contractMembership);
      
    } catch (error: any) {
      console.error("[membership-provider] Error fetching membership:", error);
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

  // ✅ NEW: Auto-refresh membership every 30 seconds for non-premium users
  // This catches new NFT mints without manual refresh
  useEffect(() => {
    if (!account?.address || membershipType === 'premium') {
      return; // Don't poll if not connected or already premium
    }

    console.log('[membership-provider] Starting auto-refresh for non-premium user');
    const intervalId = setInterval(() => {
      console.log('[membership-provider] Auto-refreshing membership...');
      localStorage.removeItem(MEMBERSHIP_CACHE_KEY);
      fetchMembershipType(account.address);
    }, 30000); // 30 seconds

    return () => {
      console.log('[membership-provider] Stopping auto-refresh');
      clearInterval(intervalId);
    };
  }, [account?.address, membershipType]);

  // ✅ NEW: Listen for manual membership update events
  useEffect(() => {
    const handleMembershipUpdate = () => {
      console.log('[membership-provider] Manual refresh triggered via event');
      if (account?.address) {
        localStorage.removeItem(MEMBERSHIP_CACHE_KEY);
        fetchMembershipType(account.address);
      }
    };

    window.addEventListener('membershipUpdated', handleMembershipUpdate);
    return () => window.removeEventListener('membershipUpdated', handleMembershipUpdate);
  }, [account?.address]);

  const hasAccess = (requiredLevel: "premium" | "freemium"): boolean => {
    try {
      if (!account?.address) {
        return false;
      }
      
      if (isLoading && !error) {
        return true; // Grant temporary access while loading
      }
      
      if (requiredLevel === "premium") {
        return membershipType === "premium";
      }
      
      return membershipType === "freemium" || membershipType === "premium";
    } catch (error) {
      console.error("[membership-provider] Error checking access:", error);
      return false;
    }
  };

  const refreshMembership = async () => {
    if (account?.address) {
      console.log("[membership-provider] 🔄 Manual refresh requested");
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
