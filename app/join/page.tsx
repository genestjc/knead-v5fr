"use client";

import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useMembership } from "@/components/membership-provider";
import { ThirdWebConnectButton } from "@/components/thirdweb-connect-button";
import { FAQDropdown } from "@/components/faq-dropdown";
import { Header } from "@/components/header";
import Link from "next/link";

export default function JoinPage() {
  const account = useActiveAccount();
  const { hasAccess, isLoading } = useMembership();
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);

  const handleSubscribe = async () => {
    if (!account?.address) {
      alert("Please connect your wallet first.");
      return;
    }

    setIsLoadingCheckout(true);

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: account.address,
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || "price_1RhFCBLFxM3QV6ciPmZnxyfL",
        }),
      });

      const data = await response.json();

      if (data.error) {
        alert(`Error: ${data.error}`);
      } else if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        alert("Unexpected error. Please try again.");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      alert("Failed to initialize checkout. Please try again.");
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  return (
    <>
      <Header />
      <section className="py-16 md:py-24">
        <div className="container-magazine text-left">
          <h1 className="font-adonis text-4xl md:text-5xl font-normal mb-8 cloud-float text-left">
            Membership Options
          </h1>
          <div className="mb-12 cloud-float-delay-1">
            <ul className="space-y-4 font-georgia-pro text-lg text-left">
            </ul>
          </div>
          
          {/* Membership Cards - Flexbox container for responsive layout */}
          <div className="flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0 mb-12 cloud-float-delay-2">
            
            {/* Free Membership Card */}
            <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm membership-card gentle-float soft-glow max-w-md w-full text-left">
              <h3 className="font-adonis text-2xl mb-4 text-left">Free Membership</h3>
              <p className="text-4xl font-adonis mb-4 text-left">
                $0
                <span className="text-base font-adonis text-gray-600">/month</span>
              </p>
              <p className="font-georgia-pro mb-6 text-left">
                <li>Read three free articles per month</li>
              </p>
              <p className="font-georgia-pro italic mb-4 text-left">
                Sign In below to get started
              </p>
              {isLoading ? (
                <div className="animate-pulse h-8 bg-gray-100 rounded"></div>
              ) : account?.address ? (
                <div className="text-green-600 font-georgia-pro text-left">
                  You're signed in!
                </div>
              ) : (
                <div className="space-y-4">
                  <ThirdWebConnectButton />
                </div>
              )}
            </div>
            
            {/* Premium Membership Card */}
            <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm membership-card gentle-float soft-glow max-w-md w-full text-left">
              <h3 className="font-adonis text-2xl mb-4 text-left">Knead Monthly</h3>
              <p className="text-4xl font-adonis mb-4 text-left">
                $5
                <span className="text-base font-adonis text-gray-600">/month</span>
              </p>
              <p className="font-georgia-pro mb-6 text-left">
                <li>Unlimited access to stories</li>
                <li>Priority access to our shop, events, and other activations</li>
              </p>
              {isLoading ? (
                <div className="animate-pulse h-12 bg-gray-100 rounded"></div>
              ) : hasAccess("premium") ? (
                <div className="text-green-600 font-georgia-pro text-left">
                  You are already a premium member!
                </div>
              ) : account?.address ? (
                <button
                  onClick={handleSubscribe}
                  disabled={isLoadingCheckout}
                  className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis w-full justify-center"
                >
                  {isLoadingCheckout ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    "Subscribe to Knead Monthly"
                  )}
                </button>
              ) : (
                <div className="space-y-4 text-center">
                  <ThirdWebConnectButton />
                </div>
              )}
            </div>
            
            {/* Breadwinner's Club Membership Card */}
            <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm membership-card gentle-float soft-glow max-w-md w-full text-left">
              <h3 className="font-adonis text-2xl mb-4 text-left">The Breadwinner's Club</h3>
              <p className="text-4xl font-adonis mb-4 text-left">
                .0042 ETH
                <span className="text-base font-adonis text-gray-600">/year</span>
              </p>
              <p className="font-georgia-pro mb-6 text-left">
                <li>Unlimited access to stories</li>
                <li>Priority access to our shop, events, and other activations</li>
                <li>Access to our limited group chat</li>
              </p>
              <a
                href="https://breadwinnersclub.kneadmag.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis w-full"
              >
                Join Today
              </a>
            </div>
          </div>
          
          {/* FAQ Section */}
          <div className="mt-16 pt-8 border-t border-gray-100 cloud-float-delay-3">
            <h2 className="font-adonis text-3xl mb-8 text-center">Frequently Asked Questions</h2>
            <div className="max-w-3xl mx-auto space-y-2 text-center">
              <FAQDropdown
                question="How does the Knead Monthly subscription work?"
                answer={
                  <span className="faq-answer text-left block">
                    We mint you a membership token that enables access to all paywalls, experiences, and other perks.
                  </span>
                }
              />
              <FAQDropdown
                question="Where do I go to cancel my membership?"
                answer={
                  <span className="faq-answer text-left block">
                    If you're interested in canceling your membership, click <a href="https://www.kneadmag.com/cancel-membership" className="underline">here</a>.
                  </span>
                }
              />
              <FAQDropdown
                question="Can I cancel my subscription at any time?"
                answer={
                  <span className="faq-answer text-left block">
                    Yes, and you'll still be granted access to our stories for the duration of your membership.
                  </span>
                }
              />
              <FAQDropdown
                question="How are payments accepted?"
                answer={
                  <span className="faq-answer text-left block">
                    We use Stripe to safely and securely process payments.
                  </span>
                }
              />
              <FAQDropdown
                question="Will I get access immediately after subscribing?"
                answer={
                  <span className="faq-answer text-left block">
                    Absolutely. We mint you a membership token to access unlimited stories and other perks.
                  </span>
                }
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
