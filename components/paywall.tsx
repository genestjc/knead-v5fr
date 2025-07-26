"use client";

import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { Modal } from "@/components/modal";
import SubscriptionFlow from "@/components/SubscriptionFlow";
import { ThirdWebConnectButton } from "@/components/thirdweb-connect-button";
import { useMembership } from "@/components/membership-provider";
import { CheckoutStatusBanner } from "@/components/CheckoutStatusBanner";

export default function Paywall() {
  const account = useActiveAccount();
  const { hasAccess, isLoading } = useMembership();
  const [showStripeModal, setShowStripeModal] =
    useState(false);

  const handleStripeSuccess = () => {
    setShowStripeModal(false);
    window.location.reload();
  };

  if (isLoading) return null;
  if (hasAccess()) return null;

  return (
    <div className="max-w-md mx-auto my-12 p-8 bg-white rounded shadow">
      <CheckoutStatusBanner />
      <h2 className="text-2xl font-adonis mb-4 text-center">
        Premium Content
      </h2>
      <p className="mb-6 text-center font-georgia-pro text-gray-600">
        This content is available to Knead Monthly
        subscribers only.
      </p>
      <div className="space-y-4">
        {!account?.address ? (
          <>
            <p className="font-georgia-pro text-sm text-gray-600 text-center">
              Connect your wallet to get started
            </p>
            <ThirdWebConnectButton />
          </>
        ) : (
          <button
            onClick={() => setShowStripeModal(true)}
            className="w-full bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis"
          >
            Subscribe for $5/month
          </button>
        )}
      </div>
      <Modal
        open={showStripeModal}
        onClose={() => setShowStripeModal(false)}
      >
        <div className="pt-4">
          <h2 className="text-2xl mb-6 text-center text-black font-adonis">
            Join Knead Monthly
          </h2>
          <p className="text-center text-gray-600 font-georgia-pro mb-6">
            $5/month • Cancel anytime
          </p>
          <SubscriptionFlow
            onSuccess={handleStripeSuccess}
          />
        </div>
      </Modal>
    </div>
  );
}
