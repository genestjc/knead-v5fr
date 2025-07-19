"use client";

import { useEffect, useState } from "react";
import {
  ConnectButton,
  useActiveAccount,
} from "thirdweb/react";
import { getContract } from "thirdweb";
import { client } from "@/thirdweb-client"; // adjust as needed

const KNEAD_MEMBERSHIP_CONTRACT = {
  address: "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85",
  tokenIds: { freemium: 0, premium: 1 },
};
const CHAIN = "base";

export default function TestSandbox() {
  const account = useActiveAccount();
  const [hasFreemium, setHasFreemium] = useState(false);
  const [hasPremium, setHasPremium] = useState(false);
  const [readCount, setReadCount] = useState(0);
  const [readError, setReadError] = useState("");
  const [minting, setMinting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [premiumLoading, setPremiumLoading] =
    useState(false);
  const [trackingRead, setTrackingRead] = useState(false);
  const [mintError, setMintError] = useState("");

  useEffect(() => {
    if (!account) return;
    setChecking(true);
    const checkNFTs = async () => {
      try {
        const contract = getContract({
          client,
          address: KNEAD_MEMBERSHIP_CONTRACT.address,
          chain: CHAIN,
        });

        const freemiumBalance =
          await contract.erc1155.balanceOf(
            account.address,
            KNEAD_MEMBERSHIP_CONTRACT.tokenIds.freemium,
          );
        const premiumBalance =
          await contract.erc1155.balanceOf(
            account.address,
            KNEAD_MEMBERSHIP_CONTRACT.tokenIds.premium,
          );

        setHasFreemium(Number(freemiumBalance) > 0);
        setHasPremium(Number(premiumBalance) > 0);
      } catch (error) {
        console.error(
          "Error checking NFT balances:",
          error,
        );
      }
      setChecking(false);
    };

    checkNFTs();
    fetchReadCount();
    // eslint-disable-next-line
  }, [account]);

  const fetchReadCount = async () => {
    if (!account) return;
    try {
      const res = await fetch("/api/track-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: account.address,
          checkOnly: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReadCount(data.reads || 0);
      }
    } catch (error) {
      console.error("Error fetching read count:", error);
    }
  };

  const mintFreemium = async () => {
    if (!account) return;
    setMinting(true);
    setMintError("");
    try {
      const res = await fetch("/api/mint-freemium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: account.address,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Mint failed");
      setHasFreemium(true);
      console.log("Freemium NFT minted successfully!");
    } catch (error: any) {
      setMintError(
        error.message || "Error minting freemium NFT",
      );
      console.error("Error minting freemium NFT:", error);
    }
    setMinting(false);
  };

  const trackRead = async () => {
    if (!account) return;
    setReadError("");
    setTrackingRead(true);

    try {
      const res = await fetch("/api/track-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: account.address,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setReadError(
          data.error || "Failed to track article read",
        );
      } else {
        setReadCount(data.reads || 0);
        setReadError("");
      }
    } catch (error) {
      setReadError("Network error occurred");
      console.error("Error tracking read:", error);
    }
    setTrackingRead(false);
  };

  const startPremium = async () => {
    if (!account) return;
    setPremiumLoading(true);

    try {
      const res = await fetch(
        "/api/create-checkout-session",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_address: account.address,
          }),
        },
      );
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL received");
      }
    } catch (error) {
      console.error("Error starting premium flow:", error);
    }
    setPremiumLoading(false);
  };

  // ...Your UI code here (reuse your existing UI, or ask for a full UI example if needed)
  // For brevity, the UI code is omitted, but your logic above is correct!
}
