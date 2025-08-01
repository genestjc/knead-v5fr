'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe outside of component
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function CheckoutForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message || 'Payment failed');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      } else {
        setErrorMessage('Payment status unknown. Please contact support.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="font-georgia-pro">
      <PaymentElement className="mb-6" />
      
      {errorMessage && (
        <div className="text-red-600 mb-4">
          {errorMessage}
        </div>
      )}
      
      <button
        type="submit"
        disabled={!stripe || isLoading}
        className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis w-full justify-center"
      >
        {isLoading ? 'Processing...' : 'Subscribe to Knead Monthly'}
      </button>
    </form>
  );
}

export default function StripePaymentForm({ 
  walletAddress,
  onSuccess
}: {
  walletAddress: string;
  onSuccess: () => void;
}) {
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    const createPaymentIntent = async () => {
      if (!walletAddress) return;
      
      try {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            amount: 500, // $5.00
            subscriptionType: 'premium'
          }),
        });
        
        const data = await response.json();
        
        if (data.error) {
          console.error('Error:', data.error);
          return;
        }
        
        setClientSecret(data.clientSecret);
      } catch (error) {
        console.error('Failed to create payment intent:', error);
      }
    };

    createPaymentIntent();
  }, [walletAddress]);

  // Options for the Stripe Element
  const options = clientSecret ? {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#000000', // Black to match your branding
        colorBackground: '#ffffff',
        colorText: '#000000',
        fontFamily: '"Georgia Pro", Georgia, serif',
      },
    },
  } : { clientSecret: '' };

  return (
    <div>
      {clientSecret ? (
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm onSuccess={onSuccess} />
        </Elements>
      ) : (
        <div className="text-center py-4 font-georgia-pro">
          Loading payment form...
        </div>
      )}
    </div>
  );
}
