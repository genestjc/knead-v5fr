// components/membership-provider.tsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  createThirdwebClient,
  getContract,
} from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { balanceOf as erc721BalanceOf } from "thirdweb/extensions/erc721";
import { base } from "thirdweb/chains";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

const MEMBERSHIP_CONTRACTS = [
  {
    address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!,
    name: "Knead Membership",
    type: "erc1155",
    tokenIds: { premium: 1, freemium: 0 },
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
    tokenIds: { annual: 1, shift: 2 },
  },
] as const;

type MembershipType = "freemium" | "premium" | null;

interface MembershipContextType {
  membershipType: MembershipType;
  isLoading: boolean;
  walletAddress: string | undefined;
  userEmail: string | null;
  setUserEmail: (email: string) => void;
  hasAccess: (
    requiredTier?: "freemium" | "premium",
  ) => boolean;
  articlesRemaining: number;
  refreshMembership: () => Promise<void>;
}

const MembershipContext = createContext<
  MembershipContextType | undefined
>(undefined);

export function MembershipProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = useActiveAccount();
  const [membershipType, setMembershipType] =
    useState<MembershipType>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [articlesRemaining, setArticlesRemaining] =
    useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(
    null,
  );

  // Try to get email from Thirdweb Embedded Wallet (social sign-in)
  useEffect(() => {
    if (window && (window as any).thirdweb) {
      const user = (window as any).thirdweb.user;
      if (user?.email) setUserEmail(user.email);
    }
  }, []);

  // Membership check
  const checkMembership = async (walletAddress: string) => {
    setIsLoading(true);
    try {
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
            const premiumBalance = await balanceOf({
              contract: contractInstance,
              owner: walletAddress,
              tokenId: BigInt(contract.tokenIds.premium),
            });
            if (premiumBalance > 0n) {
              setMembershipType("premium");
              setIsLoading(false);
              return;
            }
          }
          // Annual/Shift
          for (const [tokenType, tokenId] of Object.entries(
            contract.tokenIds,
          )) {
            if (
              tokenType !== "premium" &&
              tokenType !== "freemium"
            ) {
              const balance = await balanceOf({
                contract: contractInstance,
                owner: walletAddress,
                tokenId: BigInt(tokenId),
              });
              if (balance > 0n) {
                setMembershipType("premium");
                setIsLoading(false);
                return;
              }
            }
          }
          // Freemium
          if (contract.tokenIds.freemium !== undefined) {
            const freemiumBalance = await balanceOf({
              contract: contractInstance,
              owner: walletAddress,
              tokenId: BigInt(contract.tokenIds.freemium),
            });
            if (freemiumBalance > 0n) {
              setMembershipType("freemium");
              await checkFreemiumLimit(walletAddress);
              setIsLoading(false);
              return;
            }
          }
        } else if (contract.type === "erc721") {
          const balance = await erc721BalanceOf({
            contract: contractInstance,
            owner: walletAddress,
          });
          if (balance > 0n) {
            setMembershipType("premium");
            setIsLoading(false);
            return;
          }
        }
      }
      setMembershipType(null);
    } catch (error) {
      setMembershipType(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Freemium article limit
  const checkFreemiumLimit = async (
    walletAddress: string,
  ) => {
    try {
      const response = await fetch("/api/track-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: walletAddress.toLowerCase(),
          checkOnly: true,
        }),
      });
      const result = await response.json();
      setArticlesRemaining(
        Math.max(0, 3 - (result.reads || 0)),
      );
    } catch {
      setArticlesRemaining(0);
    }
  };

  const refreshMembership = async () => {
    if (account?.address)
      await checkMembership(account.address);
  };

  const hasAccess = (
    requiredTier: "freemium" | "premium" = "freemium",
  ) => {
    if (requiredTier === "freemium")
      return (
        membershipType === "freemium" ||
        membershipType === "premium"
      );
    return membershipType === "premium";
  };

  useEffect(() => {
    if (account?.address) checkMembership(account.address);
    else {
      setMembershipType(null);
      setIsLoading(false);
      setArticlesRemaining(0);
    }
  }, [account?.address]);

  return (
    <MembershipContext.Provider
      value={{
        membershipType,
        isLoading,
        walletAddress: account?.address,
        userEmail,
        setUserEmail,
        hasAccess,
        articlesRemaining,
        refreshMembership,
      }}
    >
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembership() {
  const context = useContext(MembershipContext);
  if (!context)
    throw new Error(
      "useMembership must be used within a MembershipProvider",
    );
  return context;
}
