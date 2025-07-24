// components/paywall.tsx
"use client";

import { useMembership } from "./membership-provider";
import { useState } from "react";
import StripeSubscription from "@/components/StripeSubscription";
import { Modal } from "@/components/modal";
import { ThirdWebConnectButton } from "@/components/thirdweb-connect-button";

export function Paywall() {
  const {
    walletAddress,
    membershipType,
    articlesRemaining,
    userEmail,
  } = useMembership();
  const [showStripe, setShowStripe] = useState(false);

  if (!walletAddress) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg max-w-md w-full mx-4">
          <h2 className="font-adonis text-2xl mb-4">
            Welcome.
          </h2>
          <p className="font-georgia-pro mb-6">
            This story is for members only, please sign in
            below with our Sign In button on the paywall.
          </p>
          <ThirdWebConnectButton />
          <div className="mt-4 text-center font-georgia-pro italic">
            Want unlimited access?{" "}
            <button
              className="underline"
              onClick={() => setShowStripe(true)}
            >
              Join Knead Monthly today
            </button>
          </div>
        </div>
        <Modal
          open={showStripe}
          onClose={() => setShowStripe(false)}
        >
          <StripeSubscription
            email={userEmail || ""}
            user_address={walletAddress}
            onSuccess={() => setShowStripe(false)}
          />
        </Modal>
      </div>
    );
  }

  if (
    membershipType === "freemium" &&
    articlesRemaining <= 0
  ) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg max-w-md w-full mx-4">
          <h2 className="font-adonis text-2xl mb-4">
            You've reached your story limit for the month.
          </h2>
          <p className="font-georgia-pro mb-6">
            Want unlimited access?{" "}
            <button
              className="underline font-georgia-pro italic"
              onClick={() => setShowStripe(true)}
            >
              Join Knead Monthly today
            </button>
          </p>
        </div>
        <Modal
          open={showStripe}
          onClose={() => setShowStripe(false)}
        >
          <StripeSubscription
            email={userEmail || ""}
            user_address={walletAddress}
            onSuccess={() => setShowStripe(false)}
          />
        </Modal>
      </div>
    );
  }

  return null; // User can access content
}
