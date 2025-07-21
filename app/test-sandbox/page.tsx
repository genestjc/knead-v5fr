"use client";

import { useEffect, useState, useRef } from "react";
import {
  ConnectButton,
  useActiveAccount,
  useReadContract,
} from "thirdweb/react";
import { getContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { balanceOf } from "thirdweb/extensions/erc1155";
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

const KNEAD_MEMBERSHIP_CONTRACT = {
  address: "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85",
  tokenIds: { freemium: 0, premium: 1 },
};

export default function TestSandbox() {
  const account = useActiveAccount();
  const [readCount, setReadCount] = useState(0);
  const [readError, setReadError] = useState("");
  const [minting, setMinting] = useState(false);
  const [premiumLoading, setPremiumLoading] =
    useState(false);
  const [trackingRead, setTrackingRead] = useState(false);
  const [mintError, setMintError] = useState("");
  const [showStripe, setShowStripe] = useState(false);
  const [stripeError, setStripeError] = useState("");
  const stripeDivRef = useRef<HTMLDivElement>(null);

  // Contract instance
  const contract = getContract({
    client,
    address: KNEAD_MEMBERSHIP_CONTRACT.address,
    chain: base,
    abi: kneadMembershipABI,
  });

  // Use useReadContract for ERC1155 balanceOf
  const {
    data: freemiumBalance,
    isLoading: isFreemiumLoading,
    refetch: refetchFreemium,
  } = useReadContract(balanceOf, {
    contract,
    owner: account?.address || "",
    tokenId: BigInt(
      KNEAD_MEMBERSHIP_CONTRACT.tokenIds.freemium,
    ),
    queryOptions: { enabled: !!account },
  });

  const {
    data: premiumBalance,
    isLoading: isPremiumLoading,
    refetch: refetchPremium,
  } = useReadContract(balanceOf, {
    contract,
    owner: account?.address || "",
    tokenId: BigInt(
      KNEAD_MEMBERSHIP_CONTRACT.tokenIds.premium,
    ),
    queryOptions: { enabled: !!account },
  });

  useEffect(() => {
    if (!account) return;
    refetchFreemium();
    refetchPremium();
    fetchReadCount();
    // eslint-disable-next-line
  }, [account]);

  const hasFreemium = (freemiumBalance ?? 0n) > 0n;
  const hasPremium = (premiumBalance ?? 0n) > 0n;

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
      refetchFreemium();
      refetchPremium();
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

  // Helper to load Stripe Embedded Checkout script only once
  const loadStripeScript = () => {
    return new Promise<void>((resolve, reject) => {
      if (document.getElementById("stripe-embedded-js")) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.id = "stripe-embedded-js";
      script.src = "https://js.stripe.com/v3/embedded.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load Stripe script"));
      document.body.appendChild(script);
    });
  };

  const startPremium = async () => {
    if (!account) return;
    setPremiumLoading(true);
    setStripeError("");
    setShowStripe(true);

    try {
      // 1. Create a session
      const res = await fetch(
        "/api/create-stripe-session",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_address: account.address,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.clientSecret)
        throw new Error(
          data.error || "Failed to create Stripe session",
        );

      // 2. Load Stripe Embedded Checkout JS
      await loadStripeScript();

      // 3. Mount the Stripe Embedded Checkout
      // Clear the container before mounting
      const container = document.getElementById(
        "stripe-checkout",
      );
      if (container) container.innerHTML = "";

      // @ts-ignore
      if (
        window.Stripe &&
        window.Stripe.initEmbeddedCheckout
      ) {
        // @ts-ignore
        window.Stripe.initEmbeddedCheckout({
          clientSecret: data.clientSecret,
          appearance: { theme: "flat" },
          onComplete: () => {
            window.location.href =
              "/test-sandbox?success=1";
          },
        }).mount("#stripe-checkout");
      } else {
        setStripeError(
          "Stripe Embedded Checkout failed to initialize.",
        );
      }
    } catch (error: any) {
      setStripeError(
        error.message || "Error starting premium flow",
      );
      setShowStripe(false);
    }
    setPremiumLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ...header, wallet, NFT status, etc. (unchanged) ... */}

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
                Unlock unlimited access with Stripe Embedded
                Checkout
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showStripe ? (
                <Button
                  onClick={startPremium}
                  disabled={premiumLoading || hasPremium}
                  className="w-full"
                  size="lg"
                  variant={
                    hasPremium ? "secondary" : "default"
                  }
                >
                  {premiumLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {hasPremium
                    ? "Premium Active"
                    : "Upgrade to Premium"}
                </Button>
              ) : (
                <div>
                  <div
                    ref={stripeDivRef}
                    id="stripe-checkout"
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Use Stripe test card{" "}
                    <b>4242 4242 4242 4242</b> with any
                    future date, CVC, and ZIP.
                  </p>
                  {stripeError && (
                    <Alert className="mt-4">
                      <AlertDescription className="text-red-600">
                        {stripeError}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ...rest of your page unchanged... */}
      </div>
    </div>
  );
}
