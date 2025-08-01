'use client';

import { useState } from 'react';
import { useActiveAccount } from "thirdweb/react";

export default function SubscriptionFlow({ onSuccess }: { onSuccess: () => void }) {
  const account = useActiveAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    if (!account?.address) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: account.address,
          priceId: 'price_1RhFCBLFxM3QV6ciPmZnxyfL', // Replace with your actual price ID
        }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        setError('Unexpected response from server');
      }
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError('Failed to initialize checkout');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="text-center p-6 space-y-4">
        <h3 className="font-adonis text-2xl">Thank you for subscribing!</h3>
        <p className="font-georgia-pro">
          You now have unlimited access to Knead Monthly content.
        </p>
        <button
          onClick={onSuccess}
          className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis"
        >
          Continue to Knead Magazine
        </button>
      </div>
    );
  }

  if (!account?.address) {
    return (
      <div className="text-center p-6 font-georgia-pro">
        Please connect your wallet to continue.
      </div>
    );
  }

  return (
    <div className="subscription-flow">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <div className="mb-4">
        <p className="font-georgia-pro mb-4">
          You'll be charged $5/month for unlimited access to Knead Monthly.
        </p>
        
        <button
          onClick={handleSubscribe}
          disabled={isLoading}
          className="w-full inline-flex justify-center items-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis"
        >
          {isLoading ? (
            <>Processing...</>
          ) : (
            <>Subscribe with Stripe</>
          )}
        </button>
      </div>
      
      <div className="mt-4 text-sm text-gray-600 font-georgia-pro">
        By subscribing, you agree to our Terms of Service and Privacy Policy.
      </div>
    </div>
  );
}
