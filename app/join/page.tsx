"use client";

import { useState, Suspense, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  
  // Get success and canceled status from URL
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  const handleSubscriptionSuccess = () => {
    setShowStripe(false);
    window.location.reload();
  };

  // Handle successful subscription when returning from Stripe
  useEffect(() => {
    if (success === 'true') {
      handleSubscriptionSuccess();
    }
  }, [success]);

  return (
    <>
      <Header />
      <section className="py-16 md:py-24">
        <div className="container-magazine text-left">
          <Suspense fallback={null}>
            <CheckoutStatusBanner />
          </Suspense>
          
          {/* Success message */}
          {success === 'true' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded">
              Your subscription was successful! You now have access to premium content.
            </div>
          )}

          {/* Canceled message */}
          {canceled === 'true' && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded">
              Payment was canceled. You can try again when you're ready.
            </div>
          )}
          
          <h1 className="font-adonis text-4xl md:text-5xl font-normal mb-8 cloud-float text-left">
            Join Knead Monthly to have access to:
          </h1>
          <div className="mb-12 cloud-float-delay-1">
            <ul className="space-y-4 font-georgia-pro text-lg text-left">
              <li>• Unlimited access to stories.</li>
              <li>
                • Priority access to our shop, events, and
                other activations.
              </li>
            </ul>
          </div>
          <div className="flex items-start mb-12 cloud-float-delay-2">
            <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm membership-card gentle-float soft-glow max-w-md w-full text-left">
              <h3 className="font-adonis text-2xl mb-4 text-left">
                Knead Monthly
              </h3>
              <p className="text-4xl font-adonis mb-4 text-left">
                $5
                <span className="text-base font-adonis text-gray-600">
                  /month
                </span>
              </p>
              <p className="font-georgia-pro mb-6 text-left">
                Get unlimited access.
              </p>
              {isLoading ? null : hasAccess("premium") ? (
                <div className="text-green-600 font-georgia-pro text-left">
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
                <div className="space-y-4 text-center">
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
            <div className="max-w-3xl mx-auto space-y-2 text-center">
              <FAQDropdown
                question="How does the Knead Monthly subscription work?"
                answer={
                  <span className="faq-answer text-left block">
                    We mint you a membership token that
                    enables access to all paywalls,
                    experiences, and other perks.
                  </span>
                }
              />
              <FAQDropdown
                question="Where do I go to cancel my membership?"
                answer={
                  <span className="faq-answer text-left block">
                    If you're interested in canceling your
                    membership, click here.
                  </span>
                }
              />
              <FAQDropdown
                question="Can I cancel my subscription at any time?"
                answer={
                  <span className="faq-answer text-left block">
                    Yes, and you'll still be granted access
                    to our stories for the duration of your
                    membership.
                  </span>
                }
              />
              <FAQDropdown
                question="How are payments accepted?"
                answer={
                  <span className="faq-answer text-left block">
                    We use Stripe to safely and securely
                    process payments.
                  </span>
                }
              />
              <FAQDropdown
                question="Will I get access immediately after subscribing?"
                answer={
                  <span className="faq-answer text-left block">
                    Absolutely. We mint you a membership
                    token to access unlimited stories and
                    other perks.
                  </span>
                }
              />
            </div>
          </div>
        </div>
        {/* Stripe Modal */}
        <Modal
          open={showStripe && !success}
          onClose={() => setShowStripe(false)}
        >
          <div className="pt-4 text-left">
            <h2 className="text-2xl mb-6 text-black font-adonis text-left">
              Join Knead Monthly
            </h2>
            <p className="text-gray-600 font-georgia-pro mb-6 text-left">
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
