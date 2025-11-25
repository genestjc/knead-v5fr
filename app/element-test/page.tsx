"use client";

import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useMembership } from "@/components/membership-provider";
import { ThirdWebConnectButton } from "@/components/thirdweb-connect-button";
import { Header } from "@/components/header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

function PaymentForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/element-test?payment=success`,
      },
    });

    if (error) {
      setErrorMessage(error.message || "An error occurred during payment.");
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />
      {errorMessage && (
        <div className="text-red-600 text-sm font-georgia-pro">
          {errorMessage}
        </div>
      )}
      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="inline-flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </>
          ) : (
            "Pay $5.00"
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-600 hover:text-gray-800 font-georgia-pro text-sm underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ElementTestPage() {
  const account = useActiveAccount();
  const { hasAccess, isLoading } = useMembership();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoadingIntent, setIsLoadingIntent] = useState(false);

  const handleOpenPaymentModal = async () => {
    if (!account?.address) {
      alert("Please connect your wallet first.");
      return;
    }

    setIsLoadingIntent(true);

    try {
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: account.address,
          amount: 500, // $5.00 in cents
        }),
      });

      const data = await response.json();

      if (data.error) {
        alert(`Error: ${data.error}`);
      } else if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setIsModalOpen(true);
      } else {
        alert("Unexpected error. Please try again.");
      }
    } catch (error) {
      console.error("Error creating payment intent:", error);
      alert("Failed to initialize payment. Please try again.");
    } finally {
      setIsLoadingIntent(false);
    }
  };

  const handlePaymentSuccess = () => {
    setIsModalOpen(false);
    setClientSecret(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setClientSecret(null);
  };

  const stripeOptions = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: "stripe" as const,
          variables: {
            colorPrimary: "#000000",
            colorBackground: "#ffffff",
            colorText: "#1a1a1a",
            colorDanger: "#dc2626",
            fontFamily: '"Georgia Pro", Georgia, serif',
            spacingUnit: "4px",
            borderRadius: "4px",
          },
          rules: {
            ".Label": {
              fontFamily: '"adonis-web", serif',
              fontSize: "14px",
              fontWeight: "400",
            },
            ".Input": {
              fontFamily: '"Georgia Pro", Georgia, serif',
              fontSize: "16px",
            },
          },
        },
      }
    : null;

  return (
    <>
      <Header />
      <section className="py-16 md:py-24">
        <div className="container-magazine text-left">
          <h1 className="font-adonis text-4xl md:text-5xl font-normal mb-8 cloud-float text-left">
            Element Test Page
          </h1>
          <p className="font-georgia-pro text-lg mb-8 text-gray-600">
            This is an isolated test page for testing Stripe Element integration
            with Payment Intent flow.
          </p>

          <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-md">
            <h3 className="font-adonis text-2xl mb-4 text-left">
              Knead Monthly
            </h3>
            <p className="text-4xl font-adonis mb-4 text-left">
              $5
              <span className="text-base font-adonis text-gray-600">/month</span>
            </p>
            <ul className="font-georgia-pro mb-6 text-left list-disc list-inside">
              <li>Unlimited access to stories</li>
              <li>Priority access to our stories, events, and other activations</li>
            </ul>
            {isLoading ? (
              <div className="animate-pulse h-12 bg-gray-100 rounded"></div>
            ) : hasAccess("premium") ? (
              <div className="text-green-600 font-georgia-pro text-left">
                You are already a premium member!
              </div>
            ) : account?.address ? (
              <button
                onClick={handleOpenPaymentModal}
                disabled={isLoadingIntent}
                className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis w-full justify-center"
              >
                {isLoadingIntent ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Loading...
                  </>
                ) : (
                  "Join Knead Monthly"
                )}
              </button>
            ) : (
              <div className="space-y-4 text-center">
                <ThirdWebConnectButton />
              </div>
            )}
          </div>
        </div>
      </section>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-adonis text-xl">
              Subscribe to Knead Monthly
            </DialogTitle>
            <DialogDescription className="font-georgia-pro">
              Enter your payment details below to complete your subscription.
            </DialogDescription>
          </DialogHeader>
          {clientSecret && stripeOptions && (
            <Elements stripe={stripePromise} options={stripeOptions}>
              <PaymentForm
                onSuccess={handlePaymentSuccess}
                onCancel={handleCloseModal}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
