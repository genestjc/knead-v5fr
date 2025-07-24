"use client"

import { useState } from "react"
import { useActiveAccount } from "thirdweb/react"
import StripeSubscription from "@/components/StripeSubscription"
import { Modal } from "@/components/modal"
import { ThirdWebConnectButton } from "@/components/thirdweb-connect-button"
import { useMembership } from "@/components/membership-provider"

interface PaywallProps {
  onSuccess?: () => void
}

export function Paywall({ onSuccess }: PaywallProps) {
  const account = useActiveAccount()
  const { userEmail } = useMembership()
  const [showStripe, setShowStripe] = useState(false)

  const handleSubscriptionSuccess = () => {
    setShowStripe(false)
    onSuccess?.()
  }

  if (!account?.address) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-md mx-auto text-center">
        <h1 className="font-adonis text-3xl mb-4">Welcome.</h1>
        <p className="font-georgia-pro mb-6 text-gray-700">This story is for members only, please sign in below.</p>
        <ThirdWebConnectButton />
      </div>
    )
  }

  return (
    <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-md mx-auto text-center">
      <h1 className="font-adonis text-3xl mb-4">Premium Content</h1>
      <p className="font-georgia-pro mb-6 text-gray-700">
        This content is available to Knead Monthly subscribers only.
      </p>

      <button
        onClick={() => setShowStripe(true)}
        className="w-full bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis mb-4"
      >
        Subscribe for $5/month
      </button>

      <Modal open={showStripe} onClose={() => setShowStripe(false)}>
        <div className="pt-4">
          <h2 className="text-2xl mb-6 text-center text-black font-adonis">Join Knead Monthly</h2>
          <p className="text-center text-gray-600 font-georgia-pro mb-6">$5/month • Cancel anytime</p>

          <StripeSubscription
            email={userEmail || ""}
            user_address={account.address}
            onSuccess={handleSubscriptionSuccess}
          />
        </div>
      </Modal>
    </div>
  )
}
