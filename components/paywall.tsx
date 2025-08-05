"use client";

import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { ThirdWebConnectButton } from "./thirdweb-connect-button";
import { useToast } from "@/hooks/use-toast";

interface PaywallProps {
  articleCount?: number;
}

export default function Paywall({ articleCount = 3 }: PaywallProps) {
  const account = useActiveAccount();
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const { toast } = useToast();

  const handleSubscribeRedirect = async () => {
    if (!account?.address) return;
    
    setIsLoadingCheckout(true);
    
    try {
      // Direct Stripe checkout - no modal
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: account.address,
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || "price_1RhFCBLFxM3QV6ciPmZnxyfL",
        }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        console.error("Error creating checkout session:", data.error);
        toast({
          title: "Error",
          description: `Failed to create checkout session: ${data.error}`,
          variant: "destructive",
        });
      } else if (data.url) {
        // Direct redirect to Stripe
        window.location.href = data.url;
      } else {
        toast({
          title: "Error",
          description: "Unexpected error. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error creating checkout session:", err);
      toast({
        title: "Error",
        description: "Failed to initialize checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  // Case 1: Not signed in
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
          Not a member? Sign up for our free membership to read.
        </p>
      </div>
    );
  }

  // Case 2: Signed in, freemium limit reached
  return (
    <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-xl mx-auto text-center">
      <h2 className="font-adonis text-2xl mb-4">
        You've reached your story limit for the month.
      </h2>
      
      <p className="font-georgia-pro italic text-gray-700 mt-4 mb-6">
        Want unlimited access?
      </p>
      
      <button
        onClick={handleSubscribeRedirect}
        disabled={isLoadingCheckout}
        className="inline-flex items-center justify-center bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis"
      >
        {isLoadingCheckout ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          "Subscribe to Knead Monthly"
        )}
      </button>
    </div>
  );
}
