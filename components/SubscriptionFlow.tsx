"use client";
import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";

export default function SubscriptionFlow() {
  const account = useActiveAccount();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(
      "/api/create-checkout-session",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          wallet_address: account?.address,
        }),
      },
    );

    const data = await res.json();
    setLoading(false);

    if (data.url) {
      window.location.href = data.url; // Redirect to Stripe Checkout
    } else {
      setError(data.error || "Failed to start checkout.");
    }
  };

  return (
    <form onSubmit={handleSubscribe} className="space-y-4">
      <input
        type="email"
        required
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2 w-full"
      />
      <button
        type="submit"
        disabled={!account?.address || loading}
        className="bg-black text-white px-4 py-2 rounded"
      >
        {loading
          ? "Redirecting..."
          : "Subscribe for $5/month"}
      </button>
      {error && <div className="text-red-500">{error}</div>}
    </form>
  );
}
