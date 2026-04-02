"use client";

import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { ThirdWebConnectButton } from "@/components/thirdweb-connect-button";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export default function CancelMembership() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNFTOnly, setHasNFTOnly] = useState(false);
  const account = useActiveAccount();
  const { toast } = useToast();

  const handleCancel = async () => {
    if (!account?.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to cancel your subscription",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasNFTOnly(false);

    try {
      // Get email from localStorage if available
      const email = localStorage.getItem(`email_${account.address}`);
      
      // Fetch subscription ID from user account
      const subscriptionResponse = await fetch(`/api/get-subscription?address=${account.address}`);
      const subscriptionData = await subscriptionResponse.json();

      // Special case: User has NFT but no subscription record
      if (subscriptionData.hasNFT && !subscriptionData.subscriptionId) {
        setHasNFTOnly(true);
        setIsLoading(false);
        return;
      }

      if (!subscriptionResponse.ok || !subscriptionData.subscriptionId) {
        throw new Error(subscriptionData.error || "No active subscription found");
      }

      const response = await fetch("/api/cancel-membership", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_address: account.address,
          email: email,
          subscriptionId: subscriptionData.subscriptionId
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to cancel subscription");
      }

      setSuccess(true);
      toast({
        title: "Subscription Cancelled",
        description: "Your membership has been cancelled and will end at the current billing period",
      });
    } catch (err: any) {
      console.error("Error cancelling subscription:", err);
      setError(err.message || "Something went wrong. Please try again.");
      toast({
        title: "Error",
        description: err.message || "Failed to cancel your subscription",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container-magazine py-16">
      <h1 className="font-adonis text-4xl mb-8">
        Cancel Membership
      </h1>
      <div className="prose prose-lg max-w-none">
        <p className="font-georgia-pro">
          We're sorry to see you go. If you wish to cancel your Knead Monthly membership, please confirm below.
        </p>
        
        {!account?.address ? (
          <div className="my-8">
            <p className="font-georgia-pro mb-4">Please connect your wallet to manage your subscription.</p>
            <ThirdWebConnectButton />
          </div>
        ) : success ? (
          <div className="my-8 p-4 bg-green-50 border border-green-200 rounded">
            <h2 className="font-adonis text-xl mb-2">Your membership has been cancelled</h2>
            <p className="font-georgia-pro">
              You'll still have access until the end of your current billing period. We hope to see you again soon!
            </p>
            <Link href="/" className="inline-block mt-4 bg-black text-white px-6 py-2 rounded font-adonis">
              Return to Home
            </Link>
          </div>
        ) : hasNFTOnly ? (
          <div className="my-8 p-4 bg-amber-50 border border-amber-200 rounded">
            <h2 className="font-adonis text-xl mb-2">Special Membership Detected</h2>
            <p className="font-georgia-pro">
              You have an active membership NFT but no associated Stripe subscription in our records. This could be because:
            </p>
            <ul className="font-georgia-pro list-disc pl-6 my-4">
              <li>Your NFT was granted directly rather than through a purchase</li>
              <li>You purchased through a special promotion</li>
              <li>There was a technical issue during your subscription setup</li>
            </ul>
            <p className="font-georgia-pro">
              Please contact us at <a href="mailto:hello@kneadmag.com" className="underline">hello@kneadmag.com</a> to cancel your membership manually.
            </p>
          </div>
        ) : error ? (
          <div className="my-8 p-4 bg-red-50 border border-red-200 rounded">
            <h2 className="font-adonis text-xl mb-2">Error</h2>
            <p className="font-georgia-pro">{error}</p>
            <button 
              onClick={() => setError(null)} 
              className="inline-block mt-4 bg-black text-white px-6 py-2 rounded font-adonis"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="my-8">
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="bg-black text-white px-6 py-3 rounded font-adonis disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                "Cancel My Membership"
              )}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
