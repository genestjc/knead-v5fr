"use client";

import { useEffect, useState } from "react";
import {
  ConnectButton,
  useActiveAccount,
} from "thirdweb/react";
import { getContract } from "thirdweb";
import {
  client,
  KNEAD_MEMBERSHIP_CONTRACT,
  CHAIN,
} from "@/thirdweb-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Crown,
  Users,
} from "lucide-react";

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

  // Check NFT balances
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

        // Check freemium balance
        const freemiumBalance =
          await contract.erc1155.balanceOf(
            account.address,
            KNEAD_MEMBERSHIP_CONTRACT.tokenIds.freemium,
          );

        // Check premium balance
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

  // Fetch article read count
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

  // Backend minting for Freemium NFT
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

  // Track article read
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

  // Start Stripe premium flow
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Knead Test Sandbox
          </h1>
          <p className="text-gray-600">
            Test the new membership system functionality
          </p>
        </div>

        {/* Wallet Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Wallet Connection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectButton client={client} />
            {!account && (
              <p className="text-sm text-gray-600 mt-2">
                Please connect your wallet to begin testing.
              </p>
            )}
          </CardContent>
        </Card>

        {account && (
          <>
            {/* Freemium NFT Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Freemium NFT (Token ID 0)
                </CardTitle>
                <CardDescription>
                  Your basic membership NFT for limited
                  article access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {checking ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Checking NFT status...</span>
                  </div>
                ) : hasFreemium ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-green-600 font-medium">
                      You have the Freemium NFT!
                    </span>
                    <Badge variant="secondary">
                      Active
                    </Badge>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="text-red-600">
                        No Freemium NFT found
                      </span>
                    </div>
                    <Button
                      onClick={mintFreemium}
                      disabled={minting}
                      className="w-full"
                    >
                      {minting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Minting...
                        </>
                      ) : (
                        "Mint Freemium NFT"
                      )}
                    </Button>
                    {mintError && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          {mintError}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Article Access Section */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Article Access Tracking
                </CardTitle>
                <CardDescription>
                  Freemium users can read 3 articles per 30
                  days
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Articles read this month:
                  </span>
                  <Badge
                    variant={
                      readCount >= 3
                        ? "destructive"
                        : "default"
                    }
                  >
                    {readCount} / 3
                  </Badge>
                </div>

                <Button
                  onClick={trackRead}
                  disabled={
                    (readCount >= 3 && !hasPremium) ||
                    trackingRead
                  }
                  className="w-full"
                  variant={
                    readCount >= 3 && !hasPremium
                      ? "destructive"
                      : "default"
                  }
                >
                  {trackingRead ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : readCount >= 3 && !hasPremium ? (
                    "Limit Reached - Upgrade to Premium"
                  ) : (
                    "Read Article (Test)"
                  )}
                </Button>

                {readError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {readError}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Premium Membership Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-600" />
                  Premium Membership (Token ID 1)
                </CardTitle>
                <CardDescription>
                  Unlimited article access for $5/month
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasPremium ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-yellow-600" />
                    <span className="text-yellow-600 font-medium">
                      You have the Premium NFT! Unlimited
                      access.
                    </span>
                    <Badge className="bg-yellow-100 text-yellow-800">
                      Premium
                    </Badge>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-gray-400" />
                      <span className="text-gray-600">
                        No Premium membership
                      </span>
                    </div>
                    <Button
                      onClick={startPremium}
                      disabled={premiumLoading}
                      className="w-full bg-yellow-600 hover:bg-yellow-700"
                    >
                      {premiumLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Redirecting to Stripe...
                        </>
                      ) : (
                        <>
                          <Crown className="mr-2 h-4 w-4" />
                          Upgrade to Premium ($5/month)
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Account Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">
                      Wallet Address:
                    </span>
                    <p className="text-gray-600 break-all">
                      {account.address}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">
                      Membership Status:
                    </span>
                    <p className="text-gray-600">
                      {hasPremium
                        ? "Premium"
                        : hasFreemium
                          ? "Freemium"
                          : "None"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
