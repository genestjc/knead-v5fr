"use client";

import { useActiveAccount } from "thirdweb/react";
import { useState, useEffect } from "react";
import { useMembership } from "./membership-provider";

export function OnboardFreemium() {
  const account = useActiveAccount();
  const { membershipType } = useMembership();
  const [minted, setMinted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Only mint if user has no membership
  useEffect(() => {
    if (account?.address && !membershipType && !minted) {
      setLoading(true);
      fetch("/api/mint-freemium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: account.address,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setMinted(true);
        })
        .finally(() => setLoading(false));
    }
  }, [account?.address, membershipType, minted]);

  // No prompt for email, just mint
  if (!account?.address || membershipType || minted)
    return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg max-w-md w-full mx-4">
          <h2 className="text-2xl font-adonis mb-4">
            Setting up your free membership...
          </h2>
        </div>
      </div>
    );
  }

  return null;
}
