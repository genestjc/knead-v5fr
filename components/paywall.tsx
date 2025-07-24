"use client"

import { useState } from "react"
import { useActiveAccount } from "thirdweb/react"
import StripeSubscription from "@/components/StripeSubscription"
import { Modal } from "@/components/modal"
import { ThirdWebConnectButton } from "@/components/thirdweb-connect-button"

interface PaywallProps {
  onSuccess?: () => void
}

export function Paywall({ onSuccess }: PaywallProps) {
  const account = useActiveAccount()
  const [showStripe, setShowStripe] = useState(false)
  const [email, setEmail] = useState("")

  const handleSubscriptionSuccess = () => {
    setShowStripe(false)
    onSuccess?.()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg max-w-md w-full mx-4">
        <h2 className="font-adonis text-2xl mb-4">Premium Content</h2>
        <p className="font-georgia-pro mb-6">This content is available to Knead Monthly subscribers only.</p>

        {account?.address ? (
          <button
            onClick={() => setShowStripe(true)}
            className="w-full bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis"
          >
            Subscribe for $5/month
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 font-georgia-pro">Connect your wallet to subscribe</p>
            <ThirdWebConnectButton />
          </div>
        )}

        <Modal open={showStripe} onClose={() => setShowStripe(false)}>
          <div className="pt-4">
            <h2 className="text-2xl mb-6 text-center text-black font-adonis">Join Knead Monthly</h2>
            <p className="text-center text-gray-600 font-georgia-pro mb-6">$5/month • Cancel anytime</p>

            {account?.address && (
              <StripeSubscription email={email} user_address={account.address} onSuccess={handleSubscriptionSuccess} />
            )}
          </div>
        </Modal>
      </div>
    </div>
  )
}
