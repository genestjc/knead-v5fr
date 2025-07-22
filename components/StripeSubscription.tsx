import React, { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe("pk_test_..."); // Your Stripe publishable key

function SubscriptionForm({
  email,
  user_address,
}: {
  email: string;
  user_address: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Fetch clientSecret from your API
    fetch("/api/create-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, user_address }),
    })
      .then((res) => res.json())
      .then((data) => setClientSecret(data.clientSecret));
  }, [email, user_address]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!stripe || !elements || !clientSecret) {
      setError("Stripe is not loaded yet.");
      setLoading(false);
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href, // Or a custom thank-you page
      },
      redirect: "if_required",
    });

    if (error) {
      setError(error.message || "Payment failed.");
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (!clientSecret)
    return <div>Loading payment form...</div>;

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          fonts: [
            {
              cssSrc:
                "https://use.typekit.net/your-adonis-kit.css", // Replace with your Typekit kit
            },
            {
              cssSrc:
                "https://fonts.googleapis.com/css2?family=Georgia+Pro:wght@400;700&display=swap",
            },
          ],
        }}
      />
      <button
        type="submit"
        disabled={!stripe || loading || success}
        style={{ marginTop: 16 }}
      >
        {loading
          ? "Processing..."
          : success
            ? "Subscription Active!"
            : "Subscribe"}
      </button>
      {error && (
        <div style={{ color: "red", marginTop: 8 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ color: "green", marginTop: 8 }}>
          Thank you for subscribing!
        </div>
      )}
    </form>
  );
}

export default function StripeSubscription({
  email,
  user_address,
}: {
  email: string;
  user_address: string;
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
            colorPrimary: "#000", // Customize as needed
          },
        },
      }}
    >
      <SubscriptionForm
        email={email}
        user_address={user_address}
      />
    </Elements>
  );
}
