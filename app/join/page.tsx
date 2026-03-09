"use client";

import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useMembership } from "@/components/membership-provider";
import { ThirdWebConnectButton } from "@/components/thirdweb-connect-button";
import { FAQDropdown } from "@/components/faq-dropdown";
import { Header } from "@/components/header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useToast } from "@/hooks/use-toast";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

function PaymentForm({
  onSuccess,
}: {
  onSuccess: (paymentIntentId: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    // ✅ CHANGED: Stay on page with redirect: 'if_required'
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required', // ← Don't redirect
    });

    if (error) {
      setErrorMessage(error.message || "An error occurred during payment.");
      setIsProcessing(false);
      return;
    }

    // ✅ NEW: Payment succeeded, pass paymentIntentId to parent
    if (paymentIntent && paymentIntent.id) {
      onSuccess(paymentIntent.id);
    } else {
      setErrorMessage("Payment completed but no payment intent returned.");
      setIsProcessing(false);
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
        <div className="text-red-600 text-sm font-georgia-pro">
          {errorMessage}
        </div>
      )}
      <div className="flex flex-col items-center gap-3">
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="inline-flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </>
          ) : (
            "Join Today"
          )}
        </button>
      </div>
    </form>
  );
}

export default function JoinPage() {
  const account = useActiveAccount();
  const { hasAccess, isLoading, refreshMembership } = useMembership();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoadingIntent, setIsLoadingIntent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // ✅ NEW: Track payment verification state
  const [paymentVerified, setPaymentVerified] = useState(false);

  const handleOpenPaymentModal = async () => {
    if (!account?.address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingIntent(true);

    try {
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: account.address,
          amount: 500, // $5.00 in cents
        }),
      });

      const data = await response.json();

      if (data.error) {
        toast({
          title: "Error",
          description: `Failed to initialize payment: ${data.error}`,
          variant: "destructive",
        });
      } else if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setIsModalOpen(true);
      } else {
        toast({
          title: "Error",
          description: "Unexpected error. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating payment intent:", error);
      toast({
        title: "Error",
        description: "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingIntent(false);
    }
  };

  // ✅ NEW: Handle payment success with server-side verification
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    if (!account?.address) return;

    setIsVerifying(true);
    setIsModalOpen(false); // Close payment modal

    try {
      console.log('[join] Verifying payment:', paymentIntentId);

      // Verify payment server-side
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId,
          walletAddress: account.address,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // ✅ Payment verified!
        console.log('[join] ✅ Payment verified');
        setPaymentVerified(true);
        setIsVerifying(false);

        toast({
          title: "Welcome to Knead Monthly! 🎉",
          description: "Your premium membership is now active!",
        });

        // Background: Clear cache and refresh membership
        localStorage.removeItem('knead_membership_cache');
        if (refreshMembership) {
          refreshMembership();
        }

        // Emit event
        window.dispatchEvent(new CustomEvent('membershipUpdated'));
      } else {
        console.error('[join] ❌ Verification failed:', result.error);
        setIsVerifying(false);
        toast({
          title: "Verification Failed",
          description: result.error || "Could not verify payment. Please contact support.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[join] Error verifying payment:', error);
      setIsVerifying(false);
      toast({
        title: "Error",
        description: "Failed to verify payment. Please refresh the page or contact support.",
        variant: "destructive",
      });
    }
  };

  const stripeOptions = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: "stripe" as const,
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
              fontSize: "14px",
              fontWeight: "400",
            },
            ".Input": {
              fontFamily: '"Georgia Pro", Georgia, serif',
              fontSize: "16px",
            },
          },
        },
      }
    : null;

  return (
    <>
      <Header />
      <section className="py-16 md:py-24">
        <div className="container-magazine text-left">
          <h1 className="font-adonis text-4xl md:text-5xl font-normal mb-8 cloud-float text-left">
            Membership Options
          </h1>
          
          {/* Membership Cards */}
          <div className="flex flex-col md:flex-row md:justify-center md:space-x-6 space-y-6 md:space-y-0 mb-12 cloud-float-delay-2">
            
            {/* Free Membership Card */}
            <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm membership-card gentle-float soft-glow max-w-md w-full text-left">
              <h3 className="font-adonis text-2xl mb-4 text-left">Free</h3>
              <p className="text-4xl font-adonis mb-4 text-left">
                $0
                <span className="text-base font-adonis text-gray-600">/month</span>
              </p>
              <p className="font-georgia-pro mb-6 text-left">
                <li>Read three stories per month</li>
              </p>
              <p className="font-georgia-pro italic mb-4 text-left">
                Sign In below to get started
              </p>
              {isLoading ? (
                <div className="animate-pulse h-8 bg-gray-100 rounded"></div>
              ) : account?.address ? (
                <div className="text-green-600 font-georgia-pro text-left">
                  You're already signed in
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
                <li>Priority access to events and other activations</li>
              </p>
              {isLoading || isVerifying ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-pulse h-12 bg-gray-100 rounded w-full"></div>
                  {isVerifying && (
                    <p className="text-sm text-gray-600 font-georgia-pro">
                      Verifying your payment...
                    </p>
                  )}
                </div>
              ) : paymentVerified || hasAccess("premium") ? (
                <div className="text-green-600 font-georgia-pro text-left">
                  ✅ You're a premium member!
                </div>
              ) : account?.address ? (
                <button
                  onClick={handleOpenPaymentModal}
                  disabled={isLoadingIntent}
                  className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingIntent ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
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
          </div>
          
          {/* FAQ Section */}
          <div className="mt-16 pt-8 border-t border-gray-100 cloud-float-delay-3">
            <h2 className="font-adonis text-3xl mb-8 text-center">Frequently Asked Questions</h2>
            <div className="max-w-3xl mx-auto space-y-2 text-center">
              <FAQDropdown
                question="How does the Knead Monthly subscription work?"
                answer={
                  <span className="faq-answer text-left block">
                    We mint you a membership NFT that enables access to all paywalls, experiences, and other perks.
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
                    Yes! Your payment is verified instantly and access is granted immediately. Your membership NFT is minted in the background.
                  </span>
                }
              />
            </div>
          </div>
        </div>
      </section>

       <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-adonis text-xl text-center">
              Subscribe to Knead Monthly
            </DialogTitle>
            <DialogDescription className="font-georgia-pro text-sm text-center text-gray-600">
              Complete your payment to get unlimited access to all Knead stories
            </DialogDescription>
          </DialogHeader>
          {clientSecret && stripeOptions && (
            <Elements stripe={stripePromise} options={stripeOptions}>
              <PaymentForm onSuccess={handlePaymentSuccess} />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
