"use client"

import { useActiveAccount } from "thirdweb/react"
import { useState, useEffect } from "react"
import { StripeSubscription } from "./StripeSubscription"
import { ThirdwebConnectButton } from "./thirdweb-connect-button"

export function Paywall({
  onSubscribe,
}: {
  onSubscribe?: () => void
}) {
  const account = useActiveAccount()
  const [reads, setReads] = useState<number | null>(null)
  const [showSubscription, setShowSubscription] = useState(false)

  useEffect(() => {
    if (!account?.address) return

    fetch("/api/track-article", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_address: account.address,
        checkOnly: true,
      }),
    })
      .then((res) => res.json())
      .then((data) => setReads(data.reads))
  }, [account?.address])

  const handleSubscribe = () => {
    setShowSubscription(true)
    onSubscribe?.()
  }

  if (showSubscription) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-md mx-auto">
        <h2 className="font-adonis text-2xl mb-4">Join Knead Monthly</h2>
        <StripeSubscription />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-md mx-auto text-center">
        <h1 className="font-adonis text-3xl mb-4">Welcome.</h1>
        <p className="font-georgia-pro mb-6 text-gray-700">
          This story is for members only, please sign in below with our Sign In button on the paywall.
        </p>

        <div className="mb-6">
          <ThirdwebConnectButton />
        </div>

        <p
          className="font-georgia-pro italic text-blue-600 hover:text-blue-800 cursor-pointer transition-colors"
          onClick={handleSubscribe}
        >
          Want unlimited access? Join Knead Monthly today.
        </p>
      </div>
    )
  }

  if (reads !== null && reads >= 3) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-md mx-auto text-center">
        <h1 className="font-adonis text-3xl mb-4">You've reached your story limit for the month.</h1>
        <p className="font-georgia-pro mb-4 text-gray-700">
          Want unlimited access?{" "}
          <span
            className="font-georgia-pro italic text-blue-600 hover:text-blue-800 cursor-pointer transition-colors"
            onClick={handleSubscribe}
          >
            Join Knead Monthly today.
          </span>
        </p>
      </div>
    )
  }

  return null // User can read the story
}
