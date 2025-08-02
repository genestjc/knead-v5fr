'use client';

import { useState } from 'react';
import { useActiveAccount } from "thirdweb/react";

export default function SubscriptionFlow({ onSuccess }: { onSuccess: () => void }) {
  const account = useActiveAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'initial' | 'processing' | 'success' | 'error'>('initial');

  const handleSubscribe = async () => {
    if (!account?.address) {
      setError("Please connect your wallet to subscribe");
      return;
    }
    
    setIsLoading(true);
    setStep('processing');
    setError(null);
    
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: account.address,
        }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setStep('error');
      } else if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        setError('Unexpected response from server');
        setStep('error');
      }
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError('Failed to initialize checkout');
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'success') {
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
      <div className="text-center p-6">
        <p className="font-georgia-pro mb-4">
          Please connect your wallet to continue.
        </p>
        <p className="text-sm text-gray-500">
          You'll need to sign in with your wallet to subscribe.
        </p>
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
          className={`w-full inline-flex justify-center items-center gap-2 bg-black text-white px-6 py-3 rounded transition-colors font-adonis ${
            isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-800'
          }`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            <>Subscribe with Stripe</>
          )}
        </button>
      </div>
      
      <div className="mt-4 text-sm text-gray-600 font-georgia-pro">
        By subscribing, you agree to our Terms of Service and Privacy Policy.
        <br />
        <span className="mt-2 block">
          Your wallet address ({account.address.substring(0, 6)}...{account.address.substring(account.address.length - 4)}) will be linked to your subscription.
        </span>
      </div>
    </div>
  );
}
