"use client";

import { useState, useEffect } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface PaymentFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
  customerId: string;
  priceId: string;
  walletAddress: string;
}

function PaymentForm({
  onSuccess,
  onError,
  customerId,
  priceId,
  walletAddress,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Confirm the SetupIntent
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (error) {
        setErrorMessage(error.message || "Payment failed");
        onError(error.message || "Payment failed");
        setIsLoading(false);
        return;
      }

      if (setupIntent && setupIntent.status === "succeeded") {
        // Now create the subscription with the payment method
        const response = await fetch("/api/confirm-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerId,
            priceId,
            paymentMethodId: setupIntent.payment_method,
            walletAddress,
          }),
        });

        const data = await response.json();

        if (data.success) {
          onSuccess();
        } else {
          setErrorMessage(data.error || "Failed to create subscription");
          onError(data.error || "Failed to create subscription");
        }
      } else {
        setErrorMessage("Payment setup was not completed");
        onError("Payment setup was not completed");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setErrorMessage(message);
      onError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded font-georgia-pro text-sm">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isLoading}
        className={`w-full inline-flex justify-center items-center gap-2 bg-black text-white px-6 py-3 rounded transition-colors font-adonis ${
          isLoading || !stripe
            ? "opacity-70 cursor-not-allowed"
            : "hover:bg-gray-800"
        }`}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Processing...
          </>
        ) : (
          "Subscribe Now — $5/month"
        )}
      </button>

      <p className="text-xs text-gray-500 font-georgia-pro text-center">
        Your payment is securely processed by Stripe.
      </p>
    </form>
  );
}

interface StripePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  walletAddress: string;
}

export function StripePaymentModal({
  isOpen,
  onClose,
  onSuccess,
  walletAddress,
}: StripePaymentModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [priceId, setPriceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && walletAddress) {
      setIsLoading(true);
      setError(null);

      fetch("/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
          priceId:
            process.env.NEXT_PUBLIC_STRIPE_PRICE_ID ||
            "price_1RhFCBLFxM3QV6ciPmZnxyfL",
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
          } else {
            setClientSecret(data.clientSecret);
            setCustomerId(data.customerId);
            setPriceId(data.priceId);
          }
        })
        .catch((err) => {
          setError(err.message || "Failed to initialize payment");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, walletAddress]);

  const handleClose = () => {
    setClientSecret(null);
    setCustomerId(null);
    setPriceId(null);
    setError(null);
    onClose();
  };

  const handleSuccess = () => {
    handleClose();
    onSuccess();
  };

  const elementsOptions: StripeElementsOptions = {
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "#000000",
        colorBackground: "#ffffff",
        colorText: "#1a1a1a",
        colorDanger: "#dc2626",
        fontFamily: '"Georgia Pro", Georgia, serif',
        spacingUnit: "4px",
        borderRadius: "4px",
      },
      rules: {
        ".Label": {
          fontFamily: '"adonis-web", serif',
          fontWeight: "400",
        },
        ".Input": {
          fontFamily: '"Georgia Pro", Georgia, serif',
          fontSize: "16px",
        },
      },
    },
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-adonis text-2xl">
            Subscribe to Knead Monthly
          </DialogTitle>
          <DialogDescription className="font-georgia-pro">
            Get unlimited access to all stories and premium content for just
            $5/month.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <svg
                className="animate-spin h-8 w-8 text-gray-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded font-georgia-pro">
              {error}
            </div>
          )}

          {clientSecret && customerId && priceId && (
            <Elements stripe={stripePromise} options={elementsOptions}>
              <PaymentForm
                onSuccess={handleSuccess}
                onError={setError}
                customerId={customerId}
                priceId={priceId}
                walletAddress={walletAddress}
              />
            </Elements>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500 font-georgia-pro">
            Wallet:{" "}
            <span className="font-mono text-xs">
              {walletAddress.substring(0, 6)}...
              {walletAddress.substring(walletAddress.length - 4)}
            </span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
