"use client";

import { useActiveAccount } from "thirdweb/react";
import { useState, useEffect } from "react";
import { useMembership } from "./membership-provider";

export function OnboardFreemium() {
  const account = useActiveAccount();
  const { userEmail, setUserEmail } = useMembership();
  const [email, setEmail] = useState(userEmail || "");
  const [showPrompt, setShowPrompt] = useState(!userEmail);
  const [minted, setMinted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (account?.address && email && !minted) {
      setLoading(true);
      fetch("/api/mint-freemium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: account.address,
          email,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setMinted(true);
        })
        .finally(() => setLoading(false));
    }
  }, [account?.address, email, minted]);

  if (!account?.address || userEmail || minted) return null;

  if (showPrompt) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg max-w-md w-full mx-4">
          <h2 className="text-2xl font-adonis mb-4">
            Welcome to Knead!
          </h2>
          <p className="text-gray-600 font-georgia-pro mb-6">
            Enter your email to complete sign-up and get 3
            free articles per month.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email) {
                setUserEmail(email);
                setShowPrompt(false);
              }
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              placeholder="your@email.com"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-2 px-4 rounded-md font-georgia-pro hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading
                ? "Setting up your account..."
                : "Continue"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}
