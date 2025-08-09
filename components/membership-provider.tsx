"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useToast } from "@/hooks/use-toast";
import { useFreemiumMembership } from "@/hooks/use-freemium-membership"; // Import the hook

type MembershipType = "premium" | "freemium" | null;

interface MembershipContextProps {
  walletAddress: string | null;
  membershipType: MembershipType;
  isLoading: boolean;
  hasAccess: (requiredLevel: "premium" | "freemium") => boolean;
  refreshMembership: () => Promise<void>;
  error: string | null;
  mintFreemium: () => Promise<void>; // Add minting function
  isMinting: boolean; // Add minting status
}

const MembershipContext = createContext<MembershipContextProps | undefined>(undefined);

export function MembershipProvider({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Use the new hook
  const {
    status,
    checkMembership,
    minting: isMinting,
    mintFreemium: mintFreemiumNFT,
    mintResult
  } = useFreemiumMembership(account?.address || null);
  
  // Convert hook status to our existing membershipType format
  const membershipType: MembershipType = 
    status === "premium" ? "premium" : 
    status === "freemium" ? "freemium" : null;
    
  const isLoading = status === "loading";
  
  // Automatically check membership when wallet changes
  useEffect(() => {
    if (account?.address) {
      checkMembership();
    }
  }, [account?.address, checkMembership]);
  
  // Show toast notifications for mint results
  useEffect(() => {
    if (mintResult) {
      if (mintResult.success) {
        toast({
          title: "Membership Activated",
          description: "Your free membership has been activated successfully!",
        });
      } else {
        setError(mintResult.error || "Failed to mint membership");
        toast({
          title: "Membership Error",
          description: mintResult.error || "Failed to activate your membership",
          variant: "destructive",
        });
      }
    }
  }, [mintResult, toast]);

  const hasAccess = (requiredLevel: "premium" | "freemium"): boolean => {
    try {
      if (!account?.address) {
        return false;
      }
      
      // Allow during loading for better UX
      if (isLoading && !error) {
        return true;
      }
      
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
      await checkMembership();
    }
  };
  
  const mintFreemium = async () => {
    if (!account?.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await mintFreemiumNFT();
    } catch (err) {
      console.error("Error minting freemium:", err);
      toast({
        title: "Error",
        description: "Failed to mint freemium membership",
        variant: "destructive",
      });
    }
  };

  const value = {
    walletAddress: account?.address || null,
    membershipType,
    isLoading,
    hasAccess,
    refreshMembership,
    error,
    mintFreemium,
    isMinting
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
