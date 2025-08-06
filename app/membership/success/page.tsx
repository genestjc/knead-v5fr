"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { useMembership } from "@/components/membership-provider";
import { useToast } from "@/hooks/use-toast";

export default function SuccessPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const account = useActiveAccount();
  const { refreshMembership } = useMembership();
  const { toast } = useToast();

  useEffect(() => {
    const session_id = searchParams.get("session_id");
    setSessionId(session_id);

    if (!session_id) {
      setIsLoading(false);
      setError("No session ID provided");
      return;
    }

    // Check subscription status
    const checkStatus = async () => {
      try {
        setIsLoading(true);
        
        // First refresh the membership status to check if NFT is already minted
        await refreshMembership();
        
        // Wait a few seconds for webhook processing
        setTimeout(() => {
          setIsLoading(false);
          toast({
            title: "Subscription Active",
            description: "Your premium membership is now active!",
          });
        }, 3000);
      } catch (err) {
        console.error("Error checking subscription status:", err);
        setIsLoading(false);
        setError("Failed to verify subscription. Please contact support.");
      }
    };

    checkStatus();
  }, [searchParams, refreshMembership, toast]);

  const handleRetryMint = async () => {
    if (!account?.address || !sessionId) return;
    
    try {
      setIsLoading(true);
      
      const response = await fetch("/api/retry-mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: account.address,
          sessionId: sessionId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to mint NFT");
      }
      
      // Refresh membership status
      await refreshMembership();
      
      toast({
        title: "Success!",
        description: "Your premium membership NFT has been minted",
      });
    } catch (err: any) {
      console.error("Error retrying mint:", err);
      setError(err.message || "Failed to mint NFT");
      
      toast({
        title: "Error",
        description: "Failed to mint membership NFT. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <div className="bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="bg-green-50 px-6 py-8 border-b border-green-100">
          <h1 className="text-3xl font-adonis text-center text-green-800">
            Subscription Successful!
          </h1>
          <p className="mt-2 text-center text-green-600 font-georgia-pro">
            Thank you for subscribing to Knead Premium.
          </p>
        </div>
        
        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
              <p className="mt-4 font-georgia-pro text-gray-600">
                Setting up your premium membership...
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4 font-georgia-pro">{error}</p>
              <button
                onClick={handleRetryMint}
                className="px-6 py-2 bg-black text-white rounded-md hover:bg-gray-800 font-adonis"
              >
                Retry Mint
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-16 w-16 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              
              <h2 className="mt-4 text-2xl font-adonis">
                Your membership is ready!
              </h2>
              
              <p className="mt-2 font-georgia-pro text-gray-600">
                You now have unlimited access to all premium content.
              </p>
              
              <div className="mt-8">
                <a
                  href="/"
                  className="px-6 py-2 bg-black text-white rounded-md hover:bg-gray-800 font-adonis"
                >
                  Start Reading
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
