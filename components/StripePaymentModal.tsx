'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/join?payment=success`,
      },
    });

    if (error) {
      setErrorMessage(error.message || 'An error occurred during payment.');
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{ layout: 'tabs' }} />
      {errorMessage && (
        <div className="text-red-600 text-sm font-georgia-pro">{errorMessage}</div>
      )}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          'Join Today'
        )}
      </button>
    </form>
  );
}

export function useStripePayment() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoadingIntent, setIsLoadingIntent] = useState(false);

  const openPaymentModal = async (walletAddress: string) => {
    setIsLoadingIntent(true);

    try {
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, amount: 500 }),
      });

      const data = await response.json();

      if (data.error) {
        alert(`Error: ${data.error}`);
      } else if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setIsModalOpen(true);
      } else {
        alert('Unexpected error. Please try again.');
      }
    } catch (error) {
      console.error('Error creating payment intent:', error);
      alert('Failed to initialize payment. Please try again.');
    } finally {
      setIsLoadingIntent(false);
    }
  };

  const StripePaymentModal = ({ onSuccess }: { onSuccess: () => void }) => {
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
              '.Label': {
                fontFamily: '"adonis-web", serif',
                fontSize: '14px',
                fontWeight: '400',
              },
              '.Input': {
                fontFamily: '"Georgia Pro", Georgia, serif',
                fontSize: '16px',
              },
            },
          },
        }
      : null;

    return (
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
            <Elements 
              stripe={stripePromise} 
              options={stripeOptions}
              key={clientSecret} // ✅ FIX: Prevents re-mounting on parent re-renders
            >
              <PaymentForm onSuccess={onSuccess} />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  return {
    openPaymentModal,
    StripePaymentModal,
    isLoadingIntent,
  };
}
