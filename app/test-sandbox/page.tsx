"use client";

import { useEffect, useState } from "react";
import {
  ConnectButton,
  useActiveAccount,
} from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { client } from "@/thirdweb-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Loader2,
  Wallet,
  Shield,
  BookOpen,
  CreditCard,
  CheckCircle,
  XCircle,
  Lock,
} from "lucide-react";
import { UnlockContent } from "@/components/unlock-content";
import kneadMembershipABI from "@/app/abi/kneadMembershipABI.json";
import StripeSubscription from "@/components/StripeSubscription";

const KNEAD_MEMBERSHIP_CONTRACT = {
  address: "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85",
  tokenIds: { freemium: 0, premium: 1 },
};

export default function TestSandbox() {
  const account = useActiveAccount();
  const [hasFreemium, setHasFreemium] = useState(false);
  const [hasPremium, setHasPremium] = useState(false);
  const [readCount, setReadCount] = useState(0);
  const [readError, setReadError] = useState("");
  const [minting, setMinting] = useState(false);
  const [checking, setChecking] = useState(false);
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
          chain: base,
          abi: kneadMembershipABI,
        });

        const freemiumBalance = await readContract({
          contract,
          method:
            "function balanceOf(address, uint256) view returns (uint256)",
          params: [
            account.address,
            KNEAD_MEMBERSHIP_CONTRACT.tokenIds.freemium,
          ],
        });

        const premiumBalance = await readContract({
          contract,
          method:
            "function balanceOf(address, uint256) view returns (uint256)",
          params: [
            account.address,
            KNEAD_MEMBERSHIP_CONTRACT.tokenIds.premium,
          ],
        });

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">
            Knead Magazine
          </h1>
          <p className="text-lg text-slate-600">
            Web3 Membership Test Sandbox
          </p>
        </div>

        {/* Wallet Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet Connection
            </CardTitle>
            <CardDescription>
              Connect your wallet to test the membership
              platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              <ConnectButton client={client} />
              {account && (
                <div className="text-center">
                  <p className="text-sm text-slate-600">
                    Connected Address:
                  </p>
                  <code className="text-sm bg-slate-100 px-2 py-1 rounded">
                    {account.address}
                  </code>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {account && (
          <>
            {/* NFT Ownership Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Membership Status
                  {checking && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </CardTitle>
                <CardDescription>
                  Your current NFT ownership on Base chain
                  (using ABI)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">
                        Freemium NFT
                      </h3>
                      <p className="text-sm text-slate-600">
                        Token ID: 0
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasFreemium ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <Badge
                            variant="default"
                            className="bg-green-100 text-green-800"
                          >
                            Owned
                          </Badge>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-500" />
                          <Badge variant="secondary">
                            Not Owned
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">
                        Premium NFT
                      </h3>
                      <p className="text-sm text-slate-600">
                        Token ID: 1
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasPremium ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <Badge
                            variant="default"
                            className="bg-green-100 text-green-800"
                          >
                            Owned
                          </Badge>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-500" />
                          <Badge variant="secondary">
                            Not Owned
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Article Read Count */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Article Read Count
                </CardTitle>
                <CardDescription>
                  Track your reading activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">
                      {readCount}
                    </p>
                    <p className="text-sm text-slate-600">
                      Articles read
                    </p>
                  </div>
                  <Button
                    onClick={trackRead}
                    disabled={trackingRead}
                    variant="outline"
                  >
                    {trackingRead && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Track New Read
                  </Button>
                </div>
                {readError && (
                  <Alert className="mt-4">
                    <AlertDescription className="text-red-600">
                      {readError}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mint Freemium */}
              <Card>
                <CardHeader>
                  <CardTitle>Mint Freemium NFT</CardTitle>
                  <CardDescription>
                    Get your free membership NFT to start
                    reading
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={mintFreemium}
                    disabled={minting || hasFreemium}
                    className="w-full"
                    size="lg"
                  >
                    {minting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {hasFreemium
                      ? "Already Owned"
                      : "Mint Freemium NFT"}
                  </Button>
                  {mintError && (
                    <Alert className="mt-4">
                      <AlertDescription className="text-red-600">
                        {mintError}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Upgrade to Premium */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Upgrade to Premium
                  </CardTitle>
                  <CardDescription>
                    Unlock unlimited access with Stripe
                    Subscription
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hasPremium ? (
                    <Button
                      disabled
                      className="w-full"
                      size="lg"
                      variant="secondary"
                    >
                      Premium Active
                    </Button>
                  ) : (
                    <StripeSubscription
                      email={
                        account?.email || "user@example.com"
                      } // Replace with actual user email if available
                      user_address={account.address}
                      onSuccess={() => {
                        setHasPremium(true);
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Paywall Test Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Paywall Test
                </CardTitle>
                <CardDescription>
                  Test the paywall component with your
                  current membership status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4">
                  <UnlockContent storySlug="test-sandbox-story">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                      <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                      <h3 className="text-lg font-semibold text-green-800 mb-2">
                        🎉 Access Granted!
                      </h3>
                      <p className="text-green-700">
                        Congratulations! Your membership NFT
                        has been verified and you have
                        access to this content.
                      </p>
                      <div className="mt-4 p-4 bg-white rounded border text-left">
                        <h4 className="font-medium mb-2">
                          Sample Premium Content:
                        </h4>
                        <p className="text-sm text-slate-600 mb-2">
                          This is what a premium article
                          would look like. Only users with
                          valid membership NFTs can see this
                          content.
                        </p>
                        <p className="text-sm text-slate-600">
                          Your paywall is working correctly!
                          The UnlockContent component
                          successfully verified your NFT
                          ownership and granted access to
                          this protected content.
                        </p>
                      </div>
                    </div>
                  </UnlockContent>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  The content above is wrapped in the
                  UnlockContent component. If you see the
                  green success message, your paywall is
                  working correctly!
                </p>
              </CardContent>
            </Card>

            {/* Contract Info */}
            <Card>
              <CardHeader>
                <CardTitle>Contract Information</CardTitle>
                <CardDescription>
                  ERC1155 contract details for testing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">
                      Contract Address:
                    </span>
                    <code className="ml-2 bg-slate-100 px-2 py-1 rounded">
                      {KNEAD_MEMBERSHIP_CONTRACT.address}
                    </code>
                  </div>
                  <div>
                    <span className="font-medium">
                      Chain:
                    </span>
                    <Badge
                      variant="outline"
                      className="ml-2"
                    >
                      Base
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">
                      Token IDs:
                    </span>
                    <span className="ml-2">
                      Freemium: 0, Premium: 1
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">
                      ABI:
                    </span>
                    <span className="ml-2">
                      Using custom Knead Membership ABI
                    </span>
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
