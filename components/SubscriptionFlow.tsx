// components/SubscriptionFlow.tsx
'use client';

import { useState } from 'react';
import StripePaymentForm from './StripePaymentForm';
import { useActiveAccount } from "thirdweb/react";

export default function SubscriptionFlow({ onSuccess }: { onSuccess: () => void }) {
  const account = useActiveAccount();
  const [isCompleted, setIsCompleted] = useState(false);

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
      <StripePaymentForm 
        walletAddress={account.address}
        onSuccess={() => setIsCompleted(true)}
      />
      <div className="mt-4 text-sm text-gray-600 font-georgia-pro">
        By subscribing, you agree to our Terms of Service and Privacy Policy.
      </div>
    </div>
  );
}
