'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe outside of component (once)
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_123');

// The inner form component that uses the Stripe hooks
function CheckoutForm({ onSuccess, walletAddress }: { 
  onSuccess: () => void, 
  walletAddress: string 
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js hasn't loaded yet
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Confirm the payment
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/membership-success`,
        },
      });

      if (error) {
        setErrorMessage(error.message || 'Payment failed');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment successful!
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
    <form onSubmit={handleSubmit} className="payment-form">
      <PaymentElement />
      
      {errorMessage && (
        <div className="error-message mt-4 text-red-500">
          {errorMessage}
        </div>
      )}
      
      <button
        type="submit"
        disabled={!stripe || isLoading}
        className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isLoading ? 'Processing...' : 'Subscribe Now'}
      </button>
    </form>
  );
}

// The wrapper component that initializes Elements
export default function PaymentForm({ 
  walletAddress, 
  amount = 2000, 
  subscriptionType = 'premium',
  email
}: {
  walletAddress: string;
  amount?: number;
  subscriptionType?: string;
  email?: string;
}) {
  const [clientSecret, setClientSecret] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    // Create PaymentIntent as soon as the component mounts
    const createPaymentIntent = async () => {
      if (!walletAddress) return;
      
      try {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            amount,
            subscriptionType,
            email
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
  }, [walletAddress, amount, subscriptionType, email]);

  const handleSuccess = () => {
    setPaymentSuccess(true);
  };

  // Options for the Stripe Element
  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#0a2540',
        colorBackground: '#ffffff',
        colorText: '#30313d',
      },
    },
  };

  if (paymentSuccess) {
    return (
      <div className="success-message p-4 bg-green-100 border border-green-400 text-green-700 rounded">
        <h3 className="text-xl font-bold">Payment Successful!</h3>
        <p>Thank you for your subscription.</p>
      </div>
    );
  }

  return (
    <div className="payment-container max-w-md mx-auto p-4 border rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Complete Your Subscription</h2>
      
      {clientSecret ? (
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm onSuccess={handleSuccess} walletAddress={walletAddress} />
        </Elements>
      ) : (
        <div className="loading">Loading payment form...</div>
      )}
    </div>
  );
}
