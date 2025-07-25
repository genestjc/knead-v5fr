"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CreditCard, Mail } from "lucide-react"
import { useActiveAccount } from "thirdweb/react"

interface SubscriptionFlowProps {
  onSuccess?: () => void
}

export default function SubscriptionFlow({ onSuccess }: SubscriptionFlowProps) {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<"email" | "payment">("email")
  const account = useActiveAccount()

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      setStep("payment")
    }
  }

  const handleStripeCheckout = async () => {
    if (!email || !account?.address) return

    setIsLoading(true)
    try {
      const response = await fetch("/api/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          user_address: account.address,
        }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error("No checkout URL received")
      }
    } catch (error) {
      console.error("Stripe checkout error:", error)
      alert("Failed to create subscription. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="font-adonis text-2xl text-gray-900">Subscribe to Knead Magazine</CardTitle>
        <CardDescription className="font-georgia-pro text-gray-600">
          {step === "email" ? "Enter your email to get started" : "Complete your subscription"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === "email" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-georgia-pro text-sm font-medium text-gray-700">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-10 font-georgia-pro"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full font-georgia-pro">
              Continue to Payment
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-georgia-pro text-sm text-gray-600">Email:</span>
                <span className="font-georgia-pro text-sm font-medium text-gray-900">{email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-georgia-pro text-sm text-gray-600">Monthly Subscription:</span>
                <span className="font-adonis text-lg font-bold text-gray-900">$5.00</span>
              </div>
            </div>

            <Button
              onClick={handleStripeCheckout}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-georgia-pro"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay with Stripe
                </>
              )}
            </Button>

            <Button variant="outline" onClick={() => setStep("email")} className="w-full font-georgia-pro">
              Back to Email
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
