"use client";

import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { createClient } from "@supabase/supabase-js";
import { useToast } from "./use-toast";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type UserStatus = "new" | "freemium" | "premium" | "loading" | "error";

export function useMembershipOnboarding() {
  const account = useActiveAccount();
  const [userStatus, setUserStatus] = useState<UserStatus>("loading");
  const [isProcessing, setIsProcessing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();
  
  // Process user when wallet connects
  useEffect(() => {
    if (!account?.address) {
      setUserStatus("new");
      return;
    }
    
    processUserConnection();
  }, [account?.address, retryCount]);
  
  const processUserConnection = async () => {
    if (!account?.address || isProcessing) return;
    
    setIsProcessing(true);
    setUserStatus("loading");
    
    try {
      // First check membership status from API
      const response = await fetch(`/api/check-membership?address=${account.address}`);
      const data = await response.json();
      
      if (data.membershipType) {
        // User already has a membership token
        setUserStatus(data.membershipType);
      } else {
        // No token found - this is either a new user or something went wrong
        // Try to mint freemium token
        await mintFreemiumToken();
      }
    } catch (error) {
      console.error("Error processing user connection:", error);
      setUserStatus("error");
      toast({
        title: "Connection Error",
        description: "Failed to process your membership. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const mintFreemiumToken = async () => {
    if (!account?.address) return;
    
    try {
      const response = await fetch("/api/onboard-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: account.address,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setUserStatus("freemium");
        toast({
          title: "Welcome to Knead!",
          description: "Your free membership has been activated.",
        });
      } else if (result.alreadyMinted) {
        // Token was already minted but our initial check missed it
        setUserStatus("freemium");
      } else {
        throw new Error(result.error || "Failed to mint freemium token");
      }
    } catch (error) {
      console.error("Error minting freemium token:", error);
      setUserStatus("error");
      toast({
        title: "Membership Error",
        description: "Failed to activate your membership. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const retry = () => {
    setRetryCount(prev => prev + 1);
  };
  
  return {
    userStatus,
    isProcessing,
    walletAddress: account?.address,
    isConnected: !!account?.address,
    retry,
    isFreemium: userStatus === "freemium",
    isPremium: userStatus === "premium",
    hasAnyMembership: userStatus === "freemium" || userStatus === "premium",
  };
}
