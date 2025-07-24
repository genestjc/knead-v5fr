"use client";

import { useMembership } from "./membership-provider";
import { useState, useEffect, type ReactNode } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  createThirdwebClient,
  getContract,
} from "thirdweb";
import { balanceOf as erc721BalanceOf } from "thirdweb/extensions/erc721";
import { base } from "thirdweb/chains";
import { Paywall } from "./paywall";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

const SINGLE_STORY_PASSES: Record<string, string> = {
  // ... your mapping here ...
};

interface UnlockContentProps {
  children: ReactNode;
  storySlug: string;
}

export function UnlockContent({
  children,
  storySlug,
}: UnlockContentProps) {
  const { walletAddress, hasAccess } = useMembership();
  const [hasSinglePass, setHasSinglePass] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }
    const checkSinglePass = async () => {
      const contractAddr = SINGLE_STORY_PASSES[storySlug];
      if (!contractAddr) {
        setHasSinglePass(false);
        setLoading(false);
        return;
      }
      const contract = getContract({
        client,
        chain: base,
        address: contractAddr,
      });
      const balance = await erc721BalanceOf({
        contract,
        owner: walletAddress,
      });
      setHasSinglePass(balance > 0n);
      setLoading(false);
    };
    checkSinglePass();
  }, [walletAddress, storySlug]);

  if (loading) return <div>Loading...</div>;
  if (hasAccess("premium") || hasSinglePass)
    return <>{children}</>;
  return <Paywall />;
}
