"use client";

import { useState, Suspense } from "react";
import { useActiveAccount } from "thirdweb/react";
import SubscriptionFlow from "@/components/SubscriptionFlow";
import { Modal } from "@/components/modal";
import { ThirdWebConnectButton } from "@/components/thirdweb-connect-button";
import { useMembership } from "@/components/membership-provider";
import { FAQDropdown } from "@/components/faq-dropdown";
import { CheckoutStatusBanner } from "@/components/CheckoutStatusBanner";
import { Header } from "@/components/header";

export default function JoinPage() {
  const account = useActiveAccount();
  const { hasAccess, isLoading } = useMembership();
  const [showStripe, setShowStripe] = useState(false);

  const handleSubscriptionSuccess = () => {
    setShowStripe(false);
    window.location.reload();
  };

  return (
    <>
      <Header />
      <section className="py-16 md:py-24">
        <div className="container-magazine">
          {/* Wrap CheckoutStatusBanner in Suspense */}
          <Suspense fallback={null}>
            <CheckoutStatusBanner />
          </Suspense>
          <h1 className="font-adonis text-4xl md:text-5xl font-normal mb-8 cloud-float">
            Join Knead Monthly to have access to:
          </h1>
          <div className="mb-12 cloud-float-delay-1">
            <ul className="space-y-4 font-georgia-pro text-lg">
              <li>• Unlimited access to stories.</li>
              <li> • Priority access to our shop, events, and
                other activations.
              </li>
            </ul>
          </div>
          <div className="flex justify-center mb-12 cloud-float-delay-2">
            <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm membership-card gentle-float soft-glow max-w-md w-full">
              <h3 className="font-adonis text-2xl mb-4">
                Knead Monthly
              </h3>
              <p className="text-4xl font-adonis mb-4">
                $5
                <span className="text-base font-adonis text-gray-600">
                  /month
                </span>
              </p>
              <p className="font-georgia-pro mb-6">
                Get unlimited access to all our stories, and enjoy priority
                access to our shop and events.
              </p>
              {isLoading ? null : hasAccess("premium") ? (
                <div className="text-green-600 font-georgia-pro text-center">
                  You are already a premium member!
                </div>
              ) : account?.address ? (
                <button
                  onClick={() => setShowStripe(true)}
                  className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis w-full justify-center"
                >
                  Subscribe to Knead Monthly
                </button>
              ) : (
                <div className="space-y-4">
                  <ThirdWebConnectButton />
                </div>
              )}
            </div>
          </div>
          {/* FAQ Section */}
          <div className="mt-16 pt-8 border-t border-gray-100 cloud-float-delay-3">
            <h2 className="font-adonis text-3xl mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <div className="max-w-3xl mx-auto space-y-2">
              <FAQDropdown
                question="How does the Knead Monthly subscription work?"
                answer="."
              />
              <FAQDropdown
                question="Where do I go to cancel my membership?"
                answer="If you're interested in canceling your membership, click here."
              />
              <FAQDropdown
                question="Can I cancel my subscription at any time?"
                answer="Yes, and you'll still be granted access to our stories for the duration of your membership."
              />  
              <FAQDropdown
                question="How are payments accepted?"
                answer="We use Stripe to safely and securely process payments."
              />
              <FAQDropdown
                question="Will I get access immediately after subscribing?"
                answer="Absolutely. We mint you a membership token to access unlimited stories and other perks."
              />
            </div>
          </div>
        </div>
        {/* Stripe Modal */}
        <Modal
          open={showStripe}
          onClose={() => setShowStripe(false)}
        >
          <div className="pt-4">
            <h2 className="text-2xl mb-6 text-center text-black font-adonis">
              Join Knead Monthly
            </h2>
            <p className="text-center text-gray-600 font-georgia-pro mb-6">
              $5/month • Cancel anytime
            </p>
            <SubscriptionFlow
              onSuccess={handleSubscriptionSuccess}
            />
          </div>
        </Modal>
      </section>
    </>
  );
}
