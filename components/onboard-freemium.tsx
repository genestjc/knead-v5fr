"use client"

import { useActiveAccount } from "thirdweb/react"
import { useState, useEffect } from "react"
import { useMintFreemium } from "@/hooks/use-mint-freemium"
import { useThirdwebUser } from "@/hooks/use-thirdweb-user"

export function OnboardFreemium({
  initialEmail,
}: {
  initialEmail?: string
}) {
  const account = useActiveAccount()
  const { userEmail, saveUserEmail } = useThirdwebUser()
  const [email, setEmail] = useState(initialEmail || userEmail || "")
  const [showPrompt, setShowPrompt] = useState(!initialEmail && !userEmail)

  const { minted, isLoading } = useMintFreemium(email)

  useEffect(() => {
    if (account?.address && !email) {
      setShowPrompt(true)
    }
  }, [account?.address, email])

  useEffect(() => {
    if (userEmail) {
      setEmail(userEmail)
      setShowPrompt(false)
    }
  }, [userEmail])

  if (!account?.address) return null

  if (showPrompt && !minted) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg max-w-md w-full mx-4">
          <h2 className="text-2xl font-adonis mb-4">Welcome to Knead!</h2>
          <p className="text-gray-600 font-georgia-pro mb-6">
            Enter your email to complete sign-up and get 3 free articles per month.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (email) {
                saveUserEmail(email)
                setShowPrompt(false)
              }
            }}
          >
            <div className="mb-4">
              <label className="block text-sm font-georgia-pro text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent font-georgia-pro"
                placeholder="your@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black text-white py-2 px-4 rounded-md font-georgia-pro hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isLoading ? "Setting up your account..." : "Continue"}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return null
}
