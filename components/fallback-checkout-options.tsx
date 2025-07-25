"use client"

import { useState } from "react"
import { useActiveAccount } from "thirdweb/react"
import SubscriptionFlow from "@/components/SubscriptionFlow"
import { Modal } from "@/components/modal"
import { ThirdWebConnectButton } from "@/components/thirdweb-connect-button"

export function FallbackCheckoutOptions() {
  const account = useActiveAccount()
  const [showStripe, setShowStripe] = useState(false)

  const handleSubscriptionSuccess = () => {
    setShowStripe(false)
    // Handle successful subscription
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="font-adonis text-xl mb-4">Alternative Payment Methods</h3>
        <p className="font-georgia-pro text-gray-600 mb-6">
          If you're having trouble with the primary checkout, try these options:
        </p>
      </div>

      {account?.address ? (
        <button
          onClick={() => setShowStripe(true)}
          className="w-full bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis"
        >
          Pay with Stripe
        </button>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 font-georgia-pro text-center">Connect your wallet first</p>
          <ThirdWebConnectButton />
        </div>
      )}

      <Modal open={showStripe} onClose={() => setShowStripe(false)}>
        <div className="pt-4">
          <h2 className="text-2xl mb-6 text-center text-black font-adonis">Complete Your Subscription</h2>
          <p className="text-center text-gray-600 font-georgia-pro mb-6">$5/month • Cancel anytime</p>

          <SubscriptionFlow onSuccess={handleSubscriptionSuccess} />
        </div>
      </Modal>
    </div>
  )
}
