"use client";

import { useActiveAccount } from "thirdweb/react";
import { useMintFreemium } from "@/hooks/use-mint-freemium";

export function OnboardFreemium() {
  const account = useActiveAccount();
  const { minted, isLoading } = useMintFreemium();

  // Optionally, show a loading spinner or success message
  if (!account?.address) return null;
  if (isLoading)
    return <div>Setting up your freemium access...</div>;
  if (minted) return null;

  return null;
}
