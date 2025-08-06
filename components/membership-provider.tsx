"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary } from "@/components/error-boundary";

type MembershipType = "premium" | "freemium" | null;

interface MembershipContextProps {
  walletAddress: string | null;
  membershipType: MembershipType;
  isLoading: boolean;
  hasAccess: (requiredLevel: "premium" | "freemium") => boolean;
  refreshMembership: () => Promise<void>;
}

const MembershipContext = createContext<MembershipContextProps | undefined>(undefined);

export function MembershipProvider({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const [membershipType, setMembershipType] = useState<MembershipType>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchMembershipType = async (address: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/check-membership?address=${address}`);
      if (!response.ok) throw new Error("Failed to fetch membership");
      
      const data = await response.json();
      setMembershipType(data.membershipType);
    } catch (error) {
      console.error("Error fetching membership:", error);
      toast({
        title: "Error",
        description: "Failed to verify your membership status",
        variant: "destructive",
      });
      setMembershipType(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!account?.address) {
      setMembershipType(null);
      setIsLoading(false);
      return;
    }

    fetchMembershipType(account.address);
  }, [account?.address]);

  const hasAccess = (requiredLevel: "premium" | "freemium"): boolean => {
    try {
      if (isLoading) return false;
      if (!account?.address) return false;
      
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
      await fetchMembershipType(account.address);
    }
  };

  const value = {
    walletAddress: account?.address || null,
    membershipType,
    isLoading,
    hasAccess,
    refreshMembership,
  };

  return (
    <ErrorBoundary>
      <MembershipContext.Provider value={value}>
        {children}
      </MembershipContext.Provider>
    </ErrorBoundary>
  );
}

export function useMembership() {
  const context = useContext(MembershipContext);
  if (context === undefined) {
    throw new Error("useMembership must be used within a MembershipProvider");
  }
  return context;
}
