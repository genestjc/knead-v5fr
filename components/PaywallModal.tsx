'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useMembership } from '@/components/membership-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X } from 'lucide-react';
import { memberFetch } from '@/lib/auth/member-fetch';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function PaymentForm({ onSuccess }: { onSuccess: (paymentIntentId: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setIsProcessing(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'An error occurred during payment.');
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.id) {
      onSuccess(paymentIntent.id);
    } else {
      setErrorMessage('Payment completed but no confirmation received.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{ layout: 'tabs' }} />
      {errorMessage && (
        <p className="text-red-600 text-sm font-georgia-pro">{errorMessage}</p>
      )}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Processing…
          </>
        ) : (
          'Join Today'
        )}
      </button>
    </form>
  );
}

export function PaywallModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const account = useActiveAccount();
  const { refreshMembership } = useMembership();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoadingIntent, setIsLoadingIntent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  async function openPayment() {
    if (!account?.address) return;
    setIsLoadingIntent(true);
    try {
      const res = await memberFetch('/api/create-payment-intent', account, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: account.address, amount: 500 }),
      });
      const data = await res.json();
      if (data.clientSecret) setClientSecret(data.clientSecret);
    } finally {
      setIsLoadingIntent(false);
    }
  }

  async function handlePaymentSuccess(paymentIntentId: string) {
    if (!account?.address) return;
    setIsVerifying(true);
    try {
      const res = await memberFetch('/api/verify-payment', account, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId, walletAddress: account.address }),
      });
      const result = await res.json();
      if (result.success) {
        setVerified(true);
        localStorage.removeItem('knead_membership_cache');
        refreshMembership?.();
        window.dispatchEvent(new CustomEvent('membershipUpdated'));
        onSuccess?.();
      }
    } finally {
      setIsVerifying(false);
    }
  }

  const stripeOptions = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: 'stripe' as const,
          variables: {
            colorPrimary: '#000000',
            colorBackground: '#ffffff',
            colorText: '#1a1a1a',
            colorDanger: '#dc2626',
            fontFamily: '"Georgia Pro", Georgia, serif',
            spacingUnit: '4px',
            borderRadius: '4px',
          },
          rules: {
            '.Label': { fontFamily: '"adonis-web", serif', fontSize: '14px', fontWeight: '400' },
            '.Input': { fontFamily: '"Georgia Pro", Georgia, serif', fontSize: '16px' },
          },
        },
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-adonis text-2xl">Knead Monthly</DialogTitle>
          <DialogDescription className="font-georgia-pro text-gray-500">
            Unlimited access to Demeter and all of Knead's stack.
          </DialogDescription>
        </DialogHeader>

        {verified ? (
          <div className="text-center py-6 space-y-3">
            <p className="font-adonis text-xl">Welcome to Knead Monthly.</p>
            <p className="font-georgia-pro text-sm text-gray-500">Your membership is active — unlimited builds await.</p>
            <button
              onClick={onClose}
              className="mt-2 bg-black text-white font-georgia-pro text-sm px-6 py-2.5 rounded-full hover:bg-gray-800 transition-colors"
            >
              Continue building →
            </button>
          </div>
        ) : isVerifying ? (
          <div className="text-center py-8">
            <span className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin inline-block mb-3" />
            <p className="font-georgia-pro text-sm text-gray-500">Activating your membership…</p>
          </div>
        ) : !account?.address ? (
          <div className="text-center py-6">
            <p className="font-georgia-pro text-sm text-gray-600 mb-2">Connect your wallet to continue.</p>
          </div>
        ) : !clientSecret ? (
          <div className="space-y-4 py-2">
            <p className="font-georgia-pro text-sm text-gray-600">
              $5/month for unlimited builds from Knead's stack.
            </p>
            <button
              onClick={openPayment}
              disabled={isLoadingIntent}
              className="w-full flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis disabled:opacity-50"
            >
              {isLoadingIntent ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading…</>
              ) : 'Subscribe with Stripe'}
            </button>
          </div>
        ) : stripeOptions ? (
          <Elements stripe={stripePromise} options={stripeOptions}>
            <PaymentForm onSuccess={handlePaymentSuccess} />
          </Elements>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
