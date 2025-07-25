"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import {
  getMembershipType,
  MembershipType,
} from "@/lib/membership";
import { getUserByWallet } from "@/lib/supabaseUser";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

interface MembershipContextType {
  membershipType: MembershipType;
  isLoading: boolean;
  walletAddress: string | undefined;
  userEmail: string | null;
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
  const [userEmail, setUserEmail] = useState<string | null>(
    null,
  );

  const refreshMembership = async () => {
    if (!account?.address) {
      setMembershipType(null);
      setUserEmail(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const type = await getMembershipType(
      client,
      account.address,
    );
    setMembershipType(type);

    if (type === "premium") {
      const user = await getUserByWallet(account.address);
      setUserEmail(user?.email ?? null);
    } else {
      setUserEmail(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refreshMembership();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  return (
    <MembershipContext.Provider
      value={{
        membershipType,
        isLoading,
        walletAddress: account?.address,
        userEmail,
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
