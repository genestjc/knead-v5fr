"use client";

import { useState, useEffect, useRef } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useMembership } from "./membership-provider";
import { ThirdWebConnectButton } from "./thirdweb-connect-button";
import { useToast } from "@/hooks/use-toast";
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
import { memberFetch } from "@/lib/auth/member-fetch";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

function PaymentForm({
  onSuccess,
}: {
  onSuccess: (paymentIntentId: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message || "An error occurred during payment.");
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.id) {
      onSuccess(paymentIntent.id);
    } else {
      setErrorMessage("Payment completed but no payment intent returned.");
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{ layout: "tabs" }} />
      {errorMessage && (
        <div className="text-red-600 text-sm font-georgia-pro">{errorMessage}</div>
      )}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="inline-flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </>
        ) : (
          "Join Today"
        )}
      </button>
    </form>
  );
}

export function FreeArticleCTA() {
  const account = useActiveAccount();
  const { hasAccess, isLoading, refreshMembership } = useMembership();
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoadingIntent, setIsLoadingIntent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);

  // When user connects wallet, auto-open payment flow
  const pendingPayment = useRef(false);
  const prevAddress = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (
      pendingPayment.current &&
      account?.address &&
      account.address !== prevAddress.current
    ) {
      pendingPayment.current = false;
      handleOpenPaymentModal();
    }
    prevAddress.current = account?.address;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  const handleOpenPaymentModal = async () => {
    if (!account?.address) {
      // Signal that once they connect, open the modal
      pendingPayment.current = true;
      return;
    }

    setIsLoadingIntent(true);

    try {
      const response = await memberFetch("/api/create-payment-intent", account, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: account.address, amount: 500 }),
      });

      const data = await response.json();

      if (data.error) {
        toast({ title: "Error", description: `Failed to initialize payment: ${data.error}`, variant: "destructive" });
      } else if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setIsModalOpen(true);
      } else {
        toast({ title: "Error", description: "Unexpected error. Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to initialize payment. Please try again.", variant: "destructive" });
    } finally {
      setIsLoadingIntent(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    if (!account?.address) return;

    setIsVerifying(true);
    setIsModalOpen(false);

    try {
      const response = await memberFetch("/api/verify-payment", account, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId, walletAddress: account.address }),
      });

      const result = await response.json();

      if (result.success) {
        setPaymentVerified(true);
        setIsVerifying(false);

        toast({ title: "Welcome to Knead Monthly! 🎉", description: "Your premium membership is now active!" });

        localStorage.removeItem("knead_membership_cache");
        if (refreshMembership) refreshMembership();
        window.dispatchEvent(new CustomEvent("membershipUpdated"));

        setTimeout(() => window.location.reload(), 3000);
      } else {
        setIsVerifying(false);
        toast({ title: "Verification Failed", description: result.error || "Could not verify payment. Please contact support.", variant: "destructive" });
      }
    } catch {
      setIsVerifying(false);
      toast({ title: "Error", description: "Failed to verify payment. Please refresh or contact support.", variant: "destructive" });
    }
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
            ".Label": { fontFamily: '"adonis-web", serif', fontSize: "14px", fontWeight: "400" },
            ".Input": { fontFamily: '"Georgia Pro", Georgia, serif', fontSize: "16px" },
          },
        },
      }
    : null;

  // Don't show CTA if already a member
  if (paymentVerified || hasAccess("premium")) {
    return null;
  }

  return (
    <>
      <div className="mt-16 pt-12 border-t border-gray-100">
        {/* Headline */}
        <div className="text-center mb-8">
          <h2 className="font-adonis text-3xl md:text-4xl mb-3">
            This story&apos;s on the house.
          </h2>
          <p className="font-georgia-pro italic text-gray-700 text-lg">
            Like what you read? Become a member today:
          </p>
        </div>

        {/* Knead Monthly card — centered */}
        <div className="flex justify-center">
          <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-md w-full text-left">
            <h3 className="font-adonis text-2xl mb-4">Knead Monthly</h3>
            <p className="text-4xl font-adonis mb-4">
              $5
              <span className="text-base font-adonis text-gray-600">/month</span>
            </p>
            <ul className="font-georgia-pro mb-6 space-y-2 list-disc list-outside pl-4">
              <li>Unlimited access to stories and chat events.</li>
              <li>Create a chat alias.</li>
              <li>Participate and comment during chat events.</li>
              <li>Receive tips from Contributors in the chat.</li>
              <li>Submit Demeter proposals in the chat.</li>
              <li>Receive gifts from Contributors in the chat.</li>
            </ul>

            {isLoading || isVerifying ? (
              <div className="flex flex-col items-center gap-2">
                <div className="animate-pulse h-12 bg-gray-100 rounded w-full" />
                {isVerifying && (
                  <p className="text-sm text-gray-600 font-georgia-pro">Verifying your payment...</p>
                )}
              </div>
            ) : account?.address ? (
              <button
                onClick={handleOpenPaymentModal}
                disabled={isLoadingIntent}
                className="inline-flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingIntent ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading...
                  </>
                ) : (
                  "Subscribe to Knead Monthly"
                )}
              </button>
            ) : (
              <div className="space-y-3 flex flex-col items-center">
                <div onClick={() => { pendingPayment.current = true; }}>
                  <ThirdWebConnectButton />
                </div>
                <p className="font-georgia-pro text-sm text-gray-500 text-center">
                  Sign in to subscribe
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-adonis text-xl text-center">
              Subscribe to Knead Monthly
            </DialogTitle>
            <DialogDescription className="font-georgia-pro text-sm text-center text-gray-600">
              Complete your payment to get unlimited access to all Knead stories
            </DialogDescription>
          </DialogHeader>
          {clientSecret && stripeOptions && (
            <Elements stripe={stripePromise} options={stripeOptions}>
              <PaymentForm onSuccess={handlePaymentSuccess} />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
