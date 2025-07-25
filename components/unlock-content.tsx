"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  createThirdwebClient,
  getContract,
} from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { balanceOf as erc721BalanceOf } from "thirdweb/extensions/erc721";
import { base } from "thirdweb/chains";
import { Paywall } from "./paywall";
import StripeSubscription from "./StripeSubscription";
import { useMembership } from "@/components/membership-provider";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

const SINGLE_STORY_PASSES: Record<string, string> = {
  // ... your mapping here ...
};

const MEMBERSHIP_CONTRACTS = [
  {
    address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!,
    name: "Knead Membership",
    type: "erc1155",
    tokenIds: {
      premium: 1,
      freemium: 0,
    },
  },
  {
    address: "0x0e70AB324E8761E97F131Eecc4Dd63dFDE33cB72",
    name: "Breadwinner's Club Membership",
    type: "erc721",
  },
  {
    address: "0xa4b1aF8cffEE71D71721cB69596C9A31ac449F13",
    name: "2025 Annual + Shift Meal Membership",
    type: "erc1155",
    tokenIds: {
      annual: 1,
      shift: 2,
    },
  },
];

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
    isLoading,
    walletAddress,
    hasAccess,
    userEmail,
  } = useMembership();
  const [canAccess, setCanAccess] = useState<
    boolean | null
  >(null);
  const [checking, setChecking] = useState(false);
  const [
    showStripeSubscription,
    setShowStripeSubscription,
  ] = useState(false);

  useEffect(() => {
    if (!account?.address) {
      setCanAccess(false);
      return;
    }
    setChecking(true);
    checkAccess(account.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, contentId]);

  const checkAccess = async (walletAddress: string) => {
    // 1. Single-story pass check
    const singleStoryContract =
      SINGLE_STORY_PASSES[contentId];
    if (singleStoryContract) {
      try {
        const contractInstance = getContract({
          client,
          chain: base,
          address: singleStoryContract,
        });
        const balance = await erc721BalanceOf({
          contract: contractInstance,
          owner: walletAddress,
        });
        if (balance > 0n) {
          setCanAccess(true);
          setChecking(false);
          return;
        }
      } catch (error) {
        // continue to next check
      }
    }

    // 2. Premium/annual/shift check
    for (const contract of MEMBERSHIP_CONTRACTS) {
      const contractInstance = getContract({
        client,
        chain: base,
        address: contract.address,
      });

      if (
        contract.type === "erc1155" &&
        contract.tokenIds
      ) {
        // Premium
        if (contract.tokenIds.premium !== undefined) {
          try {
            const premiumBalance = await balanceOf({
              contract: contractInstance,
              owner: walletAddress,
              tokenId: BigInt(contract.tokenIds.premium),
            });
            if (premiumBalance > 0n) {
              setCanAccess(true);
              setChecking(false);
              return;
            }
          } catch {}
        }
        // Annual/shift
        for (const [tokenType, tokenId] of Object.entries(
          contract.tokenIds,
        )) {
          if (
            tokenType !== "premium" &&
            tokenType !== "freemium"
          ) {
            try {
              const balance = await balanceOf({
                contract: contractInstance,
                owner: walletAddress,
                tokenId: BigInt(tokenId),
              });
              if (balance > 0n) {
                setCanAccess(true);
                setChecking(false);
                return;
              }
            } catch {}
          }
        }
        // Freemium (check limit)
        if (contract.tokenIds.freemium !== undefined) {
          try {
            const freemiumBalance = await balanceOf({
              contract: contractInstance,
              owner: walletAddress,
              tokenId: BigInt(contract.tokenIds.freemium),
            });
            if (freemiumBalance > 0n) {
              // Call API to track and enforce article limit
              const response = await fetch(
                "/api/track-article",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    user_address:
                      walletAddress.toLowerCase(),
                  }),
                },
              );
              const result = await response.json();
              if (response.ok && result.success) {
                setCanAccess(true);
              } else {
                setCanAccess(false);
              }
              setChecking(false);
              return;
            }
          } catch {}
        }
      } else if (contract.type === "erc721") {
        try {
          const balance = await erc721BalanceOf({
            contract: contractInstance,
            owner: walletAddress,
          });
          if (balance > 0n) {
            setCanAccess(true);
            setChecking(false);
            return;
          }
        } catch {}
      }
    }

    // 3. No access found
    setCanAccess(false);
    setChecking(false);
  };

  if (isLoading || checking || canAccess === null) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (
    !walletAddress ||
    !hasAccess("freemium") ||
    canAccess === false
  ) {
    return <Paywall />;
  }

  // Show Stripe subscription modal if requested
  if (showStripeSubscription && account?.address) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg max-w-md w-full mx-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-adonis">
              Join Knead Monthly
            </h2>
            <button
              onClick={() =>
                setShowStripeSubscription(false)
              }
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          <StripeSubscription
            email={userEmail || ""}
            user_address={account.address}
            onSuccess={() => {
              setShowStripeSubscription(false);
              checkAccess(account.address);
            }}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
