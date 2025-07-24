"use client"

import { useState } from "react"
import { useActiveAccount } from "thirdweb/react"
import { Header } from "@/components/header"
import StripeSubscription from "@/components/StripeSubscription"
import { Modal } from "@/components/modal"
import { FAQDropdown } from "@/components/faq-dropdown"
import { ThirdwebConnectButton } from "@/components/thirdweb-connect-button"

export default function JoinPage() {
  const account = useActiveAccount()
  const [showStripe, setShowStripe] = useState(false)
  const [email, setEmail] = useState("")

  const handleSubscriptionSuccess = () => {
    setShowStripe(false)
    // Handle successful subscription
  }

  return (
    <main className="min-h-screen">
      <Header />

      <section className="py-16 md:py-24">
        <div className="container-magazine">
          <h1 className="font-adonis text-4xl md:text-5xl font-normal mb-8 cloud-float">
            Join Knead Monthly to have access to:
          </h1>

          <div className="mb-12 cloud-float-delay-1">
            <ul className="space-y-4 font-georgia-pro text-lg">
              <li>• Unlimited access to stories.</li>
              <li>• Access to The Groupchat.</li>
              <li>• Priority access to our shop, events, and other activations.</li>
            </ul>
          </div>

          <div className="flex justify-center mb-12 cloud-float-delay-2">
            {/* Knead Monthly - Only Option */}
            <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm membership-card gentle-float soft-glow max-w-md w-full">
              <h3 className="font-adonis text-2xl mb-4">Knead Monthly</h3>
              <p className="text-4xl font-adonis mb-4">
                $5<span className="text-base font-adonis text-gray-600">/month</span>
              </p>
              <p className="font-georgia-pro mb-6">
                Get unlimited access to all our stories, join The Groupchat, and enjoy priority access to our shop and
                events.
              </p>

              {account?.address ? (
                <button
                  onClick={() => setShowStripe(true)}
                  className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis w-full justify-center"
                >
                  Subscribe to Knead Monthly
                </button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 font-georgia-pro mb-4">Connect your wallet to subscribe</p>
                  <ThirdwebConnectButton />
                </div>
              )}
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mt-16 pt-8 border-t border-gray-100 cloud-float-delay-3">
            <h2 className="font-adonis text-3xl mb-8 text-center">Frequently Asked Questions</h2>

            <div className="max-w-3xl mx-auto space-y-2">
              <FAQDropdown
                question="What if I already signed up for a 2025 Annual or Shift Meal membership?"
                answer="Those memberships are already included in our paywall. Connect your wallet to verify your existing membership status."
              />

              <FAQDropdown
                question="How do I use my Knead Monthly membership?"
                answer="You need to transfer the NFT into a wallet compatible with ThirdWeb (I.E., MetaMask, Rainbow Wallet, etc). Once connected, your membership will be automatically verified."
              />

              <FAQDropdown
                question="My membership isn't working."
                answer="Email us at info@kneadmag.com and we'll help resolve any issues with your membership access."
              />

              <FAQDropdown
                question="Can I cancel my subscription anytime?"
                answer="Yes, you can cancel your Knead Monthly subscription at any time. Your access will continue until the end of your current billing period."
              />

              <FAQDropdown
                question="What is The Groupchat?"
                answer="The Groupchat is our exclusive member community where you can connect with other food enthusiasts, participate in discussions, and get early access to content and events."
              />

              <FAQDropdown
                question="Do you offer student discounts?"
                answer="We currently don't offer student discounts, but we occasionally run promotional pricing. Follow us on social media or subscribe to our newsletter to stay updated on special offers."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stripe Modal */}
      <Modal open={showStripe} onClose={() => setShowStripe(false)}>
        <div className="pt-4">
          <h2 className="text-2xl mb-6 text-center text-black font-adonis">Join Knead Monthly</h2>
          <p className="text-center text-gray-600 font-georgia-pro mb-6">$5/month • Cancel anytime</p>

          {account?.address && (
            <StripeSubscription email={email} user_address={account.address} onSuccess={handleSubscriptionSuccess} />
          )}
        </div>
      </Modal>
    </main>
  )
}
