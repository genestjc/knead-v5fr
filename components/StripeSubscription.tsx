import React, { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe("pk_test_51RT7RWLFxM3QV6cipWySqQ7Z9960apeyI2R7RVu29xSY2N1CT1dZwvagvZwEsbsEvbildSwuxota3BmfvxFapV0D00wpWvlVjJ"); // Replace with your Stripe test publishable key

function SubscriptionForm({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!stripe || !elements) {
      setError("Stripe is not loaded yet.");
      setLoading(false);
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      setError(error.message || "Payment failed.");
      setLoading(false);
    } else {
      setLoading(false);
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || loading}
        style={{ marginTop: 16 }}
      >
        {loading ? "Processing..." : "Subscribe"}
      </button>
      {error && (
        <div style={{ color: "red", marginTop: 8 }}>
          {error}
        </div>
      )}
    </form>
  );
}

export default function StripeSubscription({
  email,
  user_address,
  onSuccess,
}: {
  email: string;
  user_address: string;
  onSuccess: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<
    string | null
  >(null);

  useEffect(() => {
    fetch("/api/create-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, user_address }),
    })
      .then((res) => res.json())
      .then((data) => setClientSecret(data.clientSecret));
  }, [email, user_address]);

  if (!clientSecret)
    return <div>Loading payment form...</div>;

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "flat",
          variables: {
            fontFamily: "Adonis, 'Georgia Pro', serif",
            colorPrimary: "#000",
          },
        },
        fonts: [
          { cssSrc: "https://use.typekit.net/gne1bgd.css" }, // Replace with your actual Typekit kit
          {
            cssSrc:
              "https://fonts.googleapis.com/css2?family=Georgia+Pro:wght@400;700&display=swap",
          },
        ],
      }}
    >
      <SubscriptionForm onSuccess={onSuccess} />
    </Elements>
  );
}
