"use client";

import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { ThirdWebConnectButton } from "./thirdweb-connect-button";
import { useToast } from "@/hooks/use-toast";
import { useMembership } from "./membership-provider";
import { useFreemiumMembership } from "@/hooks/use-freemium-membership";
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
import { hasKneadMonthly } from "@/lib/blockchain/check-nft-ownership";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

function PaymentForm({
  onSuccess,
}: {
  onSuccess: () => void;
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
        return_url: `${window.location.origin}${window.location.pathname}?payment=success`,
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
      <div className="flex flex-col items-center gap-3">
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
            "Join Today"
          )}
        </button>
      </div>
    </form>
  );
}

interface PaywallProps {
  articleCount?: number;
}

export default function Paywall({ articleCount: _articleCount = 3 }: PaywallProps) {
  const account = useActiveAccount();
  const [isLoadingIntent, setIsLoadingIntent] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isRefreshingMembership, setIsRefreshingMembership] = useState(false);
  const { toast } = useToast();
  const { membershipType: _membershipType, refreshMembership } = useMembership();
  const { status: _status, minting } = useFreemiumMembership(account?.address || null);

  // Check URL for payment success on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      // Payment was successful, refresh membership
      handlePaymentReturn();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const pollForNFT = async (walletAddress: string, maxAttempts = 15, delayMs = 2000) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔄 Polling for NFT (attempt ${attempt}/${maxAttempts})...`);
      
      // Wait before checking (except first attempt)
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      // Use existing blockchain check function
      const hasNFT = await hasKneadMonthly(walletAddress);
      
      if (hasNFT) {
        console.log("✅ Premium NFT detected on blockchain!");
        
        // Now that we confirmed NFT exists, refresh the membership provider
        // Clear cache first to force fresh check
        localStorage.removeItem("knead_membership_cache");
        if (refreshMembership) {
          await refreshMembership();
        }
        
        return true;
      }
    }
    
    console.log("⚠️ NFT not detected after max attempts");
    return false;
  };

  const handlePaymentReturn = async () => {
    if (!account?.address || !refreshMembership) return;
    
    setIsRefreshingMembership(true);
    try {
      console.log("💎 Payment successful! Checking for NFT mint...");
      
      // Poll directly for NFT (15 attempts × 2 seconds = 30 seconds max)
      const success = await pollForNFT(account.address, 15, 2000);
      
      if (success) {
        toast({
          title: "Welcome!",
          description: "Your membership is now active. Enjoy unlimited access!",
        });
      } else {
        toast({
          title: "Almost there...",
          description: "Your membership is being activated. Please refresh in a moment.",
          variant: "default",
        });
      }
    } finally {
      setIsRefreshingMembership(false);
    }
  };

  const handleOpenPaymentModal = async () => {
    if (!account?.address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
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
        toast({
          title: "Error",
          description: `Failed to initialize payment: ${data.error}`,
          variant: "destructive",
        });
      } else if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setIsModalOpen(true);
      } else {
        toast({
          title: "Error",
          description: "Unexpected error. Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingIntent(false);
    }
  };

  const handlePaymentSuccess = async () => {
    setIsModalOpen(false);
    setClientSecret(null);
    
    if (!account?.address) return;
    
    setIsRefreshingMembership(true);
    try {
      console.log("💎 Payment successful! Checking for NFT mint...");
      
      // Poll directly for NFT (15 attempts × 2 seconds = 30 seconds max)
      const success = await pollForNFT(account.address, 15, 2000);
      
      if (success) {
        toast({
          title: "Success",
          description: "Payment successful! Your membership is now active.",
        });
      } else {
        toast({
          title: "Almost there...",
          description: "Your membership is being activated. Please refresh in a moment.",
          variant: "default",
        });
      }
    } finally {
      setIsRefreshingMembership(false);
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

  // Show loading state while auto-minting is happening or refreshing membership
  if (minting || isRefreshingMembership) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-xl mx-auto text-center">
        <h2 className="font-adonis text-2xl mb-4">
          {isRefreshingMembership ? "Activating your membership..." : "Setting up your membership..."}
        </h2>
        <div className="flex justify-center my-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
        <p className="font-georgia-pro text-gray-700">
          Just a moment while we activate your access...
        </p>
      </div>
    );
  }

  // Case 1: Not signed in - show connect button
  if (!account?.address) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-xl mx-auto text-center">
        <h2 className="font-adonis text-2xl mb-4">
          This story is for members only
        </h2>
        
        <div className="my-6 flex justify-center">
          <ThirdWebConnectButton />
        </div>
        
        <p className="font-georgia-pro text-gray-700 mt-4">
          Not a member? Sign in to create an account.
        </p>
      </div>
    );
  }

  // Case 2: Signed in with freemium but hit article limit
  return (
    <>
      <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-xl mx-auto text-center">
        <h2 className="font-adonis text-2xl mb-4">
          You&apos;ve reached your story limit for the month.
        </h2>
        
        <p className="font-georgia-pro italic text-gray-700 mt-4 mb-6">
          Want unlimited access?
        </p>
        
        <button
          onClick={handleOpenPaymentModal}
          disabled={isLoadingIntent}
          className="inline-flex items-center justify-center bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingIntent ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </>
          ) : (
            "Subscribe to Knead Monthly"
          )}
        </button>
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
              <PaymentForm
                onSuccess={handlePaymentSuccess}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
