"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
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

/**
 * How long we'll block on a first-visit membership check before letting the UI
 * move on. The check is two Base contract reads; if the RPC never answers, the
 * promise never settles, and `isLoading` used to stay true for the life of the
 * page. Anything reading `isLoading` as "probably a member" (hasAccess does, to
 * avoid paywall flicker) then stayed wrong forever — which is how the
 * free-article CTA went missing for signed-in readers. The check keeps running
 * past this deadline; its answer is applied whenever it lands.
 */
const MEMBERSHIP_CHECK_TIMEOUT_MS = 8000;

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
  const requestedAddress = useRef<string | null>(null);
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
      const cacheDuration = type === 'premium' 
        ? 6 * 60 * 60 * 1000  // 6 hours for premium
        : 5 * 60 * 1000;      // 5 minutes for freemium/null

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
    // Guards against a slow check for a previous wallet landing after the reader
    // switched accounts and overwriting the current wallet's membership.
    requestedAddress.current = address;
    const isStale = () => requestedAddress.current !== address;

    try {
      setIsLoading(true);
      setError(null);

      const cachedMembership = getCachedMembership(address);
      if (cachedMembership) {
        setMembershipType(cachedMembership.type);
        setIsLoading(false);

        // Silent background verification — no loading state, no flicker
        checkMembershipFromContract(address)
          .then(freshMembership => {
            if (isStale()) return;
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

      // No cache — fetch from blockchain, but don't let an unanswered RPC keep
      // the whole app in its loading state.
      const contractCheck = checkMembershipFromContract(address);
      const applyResult = (membership: MembershipType) => {
        if (isStale()) return;
        cacheMembership(address, membership);
        setMembershipType(membership);
      };

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timedOut = await Promise.race([
        contractCheck.then(() => false),
        new Promise<boolean>((resolve) => {
          timeoutId = setTimeout(() => resolve(true), MEMBERSHIP_CHECK_TIMEOUT_MS);
        }),
      ]);
      if (timeoutId) clearTimeout(timeoutId);

      if (timedOut) {
        console.warn(
          `[membership-provider] ⏱️ Membership check still pending after ${MEMBERSHIP_CHECK_TIMEOUT_MS}ms — treating as no membership until it answers`,
        );
        if (!isStale()) {
          setMembershipType(null);
          setIsLoading(false);
        }
        // Not cached above: a late answer is still authoritative, so apply it.
        contractCheck
          .then(applyResult)
          .catch(err => console.error("[membership-provider] Late membership check failed:", err));
        return;
      }

      applyResult(await contractCheck);

    } catch (error: any) {
      console.error("[membership-provider] Error fetching membership:", error);
      if (!isStale()) {
        setError("Couldn't verify membership status");
        setMembershipType(null);
      }
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  };

  // Check membership on wallet connect/disconnect
  useEffect(() => {
    if (!account?.address) {
      // Clearing this discards any in-flight check for the wallet that just
      // disconnected, so its result can't be applied to a signed-out reader.
      requestedAddress.current = null;
      setMembershipType(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    fetchMembershipType(account.address);
  }, [account?.address]);

  // Listen for manual membership update events (e.g. after upgrade)
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
      if (!account?.address) return false;
      if (isLoading && !error) return true; // Grant temporary access while loading
      if (requiredLevel === "premium") return membershipType === "premium";
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
