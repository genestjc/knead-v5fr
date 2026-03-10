"use client";

import React, { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import Paywall from "./paywall";
import { useMembership } from "@/components/membership-provider";
import { useToast } from "@/hooks/use-toast";
import { ARTICLE_LIMITS } from "@/lib/constants";
import { getMembershipType } from "@/lib/membership";

// Create ThirdWeb client
const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    (process.env.NODE_ENV !== "production"
      ? "44984f2bc038cebc6138d4ceb602c35d"
      : undefined),
});

interface UnlockContentProps {
  children: ReactNode;
  contentId: string;
}

export function UnlockContent({
  children,
  contentId,
}: UnlockContentProps) {
  const account = useActiveAccount();
  const {
    membershipType,
    isLoading: membershipLoading,
    hasAccess,
  } = useMembership();
  const [canAccess, setCanAccess] = useState<boolean | null>(null);
  const [articleCount, setArticleCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!account?.address) {
      setCanAccess(false);
      setIsLoading(false);
      return;
    }
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, contentId]);

  const safeMembershipCheck = (
    level: "premium" | "freemium",
  ): boolean => {
    try {
      return hasAccess(level);
    } catch {
      return false;
    }
  };

  const checkAccess = async () => {
    if (!account?.address) return;

    setIsLoading(true);
    setError(null);
    
    try {
      // Use comprehensive membership checker (checks ALL contracts)
      const membershipType = await getMembershipType(client, account.address);
      
      // 1. Premium users get unlimited access
      if (membershipType === "premium") {
        console.log("✅ Premium access granted");
        setCanAccess(true);
        setIsLoading(false);
        return;
      }

      // 2. Freemium logic (includes users with NO NFT - race condition handling)
      // This handles:
      // - Users with freemium NFT (normal case)
      // - Users where mint is in progress (membershipType === null)
      // - Users where mint failed (still get 3 free articles)
      if (membershipType === "freemium" || membershipType === null) {
        console.log(`📖 Checking article limit (membership: ${membershipType || 'none - treating as freemium'})`);
        await checkFreemiumLimit();
        return;
      }
      
      // 3. Should never reach here (all cases handled above)
      console.warn('⚠️ Unexpected membership state:', membershipType);
      setCanAccess(false);
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking access:', error);
      setError("Failed to verify your access. Please try again.");
      toast({
        title: "Access Error",
        description: "We couldn't verify your membership status. Please try again.",
        variant: "destructive",
      });
      setCanAccess(false);
      setIsLoading(false);
    }
  };

  const checkFreemiumLimit = async () => {
    if (!account?.address) return;

    try {
      // Check if user has already read this article
      const response = await fetch("/api/track-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_address: account.address.toLowerCase(),
          story_slug: contentId,
          checkOnly: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      setArticleCount(result.reads || 0);

      // Already read this article before
      if (result.alreadyRead) {
        setCanAccess(true);
        setIsLoading(false);
        return;
      }

      // Check if under article limit
      if ((result.reads || 0) < ARTICLE_LIMITS.FREEMIUM) {
        // Record this article view
        const trackResponse = await fetch("/api/track-article", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_address: account.address.toLowerCase(),
            story_slug: contentId,
          }),
        });

        if (trackResponse.ok) {
          setCanAccess(true);
        } else {
          const trackResult = await trackResponse.json();
          setError(trackResult.error || "Failed to record article view");
          setCanAccess(false);
        }
      } else {
        // Hit article limit
        setCanAccess(false);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error checking freemium limit:', error);
      setCanAccess(false);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to check your article limit. Please try refreshing.",
        variant: "destructive",
      });
    }
  };

  // Loading state
  if (isLoading || membershipLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={checkAccess}
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
        >
          Try Again
        </button>
      </div>
    );
  }

  // No wallet connected - show visitor paywall
  if (!account?.address) {
    return <Paywall />;
  }

  // Access denied or undetermined (null) - show paywall
  if (canAccess === false || canAccess === null) {
    if (
      safeMembershipCheck("freemium") &&
      articleCount >= ARTICLE_LIMITS.FREEMIUM
    ) {
      return <Paywall articleCount={articleCount} />;
    }
    return <Paywall />;
  }

  // User has access
  return <>{children}</>;
}
