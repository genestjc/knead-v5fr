"use client"

import { useState } from "react"
import { useActiveAccount } from "thirdweb/react"
import { Modal } from "@/components/modal"
import SubscriptionFlow from "@/components/SubscriptionFlow"
import { ThirdWebConnectButton } from "@/components/thirdweb-connect-button"
import { useMembership } from "@/components/membership-provider"

export default function Paywall() {
  const account = useActiveAccount()
  const { hasAccess } = useMembership()
  const [showStripeModal, setShowStripeModal] = useState(false)

  const handleStripeSuccess = () => {
    setShowStripeModal(false)
    // Refresh membership status
    window.location.reload()
  }

  // If user has access, don't show paywall
  if (hasAccess()) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 className="font-adonis text-2xl mb-4 text-center">Premium Content</h2>
        <p className="font-georgia-pro text-gray-600 mb-6 text-center">
          This content is available to Knead Monthly subscribers only.
        </p>

        <div className="space-y-4">
          {!account?.address ? (
            <>
              <p className="font-georgia-pro text-sm text-gray-600 text-center">Connect your wallet to get started</p>
              <ThirdWebConnectButton />
            </>
          ) : (
            <button
              onClick={() => setShowStripeModal(true)}
              className="w-full bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis"
            >
              Subscribe for $5/month
            </button>
          )}
        </div>
      </div>

      <Modal open={showStripeModal} onClose={() => setShowStripeModal(false)}>
        <div className="pt-4">
          <h2 className="text-2xl mb-6 text-center text-black font-adonis">Join Knead Monthly</h2>
          <p className="text-center text-gray-600 font-georgia-pro mb-6">$5/month • Cancel anytime</p>

          <SubscriptionFlow onSuccess={handleStripeSuccess} />
        </div>
      </Modal>
    </div>
  )
}
