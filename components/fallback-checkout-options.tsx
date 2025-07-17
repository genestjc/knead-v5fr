"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, CreditCard, Wallet } from "lucide-react"

export function FallbackCheckoutOptions() {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)

  const handleEmailSignup = () => {
    const subject = "Knead Monthly Membership - Technical Issue"
    const body = `Hi Knead team,

I'd like to sign up for a Knead Monthly membership ($5/month) but encountered a technical issue with the Unlock Protocol checkout.

Could you please help me set up my membership manually?

Thanks!`

    window.open(`mailto:hello@kneadmag.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
    setSelectedMethod("email")
  }

  const handleDirectTransfer = () => {
    // For users who want to pay directly via crypto
    setSelectedMethod("crypto")
  }

  const handleStripeAlternative = () => {
    // Placeholder for future Stripe integration
    alert("Stripe integration coming soon! Please use email signup for now.")
    setSelectedMethod("stripe")
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800">Backup Payment Options</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-700 mb-4">
            While we work on the Unlock Protocol integration, you can still join Knead using these alternatives:
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Email Signup */}
        <Card className={`cursor-pointer transition-all ${selectedMethod === "email" ? "ring-2 ring-blue-500" : ""}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4" />
              Email Signup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600 mb-3">Quick and easy - we'll handle everything manually</p>
            <Button onClick={handleEmailSignup} size="sm" className="w-full">
              Send Email
            </Button>
            <p className="text-xs text-green-600 mt-2">✓ Available now</p>
          </CardContent>
        </Card>

        {/* Direct Crypto Payment */}
        <Card className={`cursor-pointer transition-all ${selectedMethod === "crypto" ? "ring-2 ring-blue-500" : ""}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet className="w-4 h-4" />
              Direct Crypto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600 mb-3">Send payment directly to our wallet</p>
            <Button onClick={handleDirectTransfer} size="sm" variant="outline" className="w-full">
              Get Address
            </Button>
            <p className="text-xs text-gray-500 mt-2">⚠️ Manual verification</p>
          </CardContent>
        </Card>

        {/* Future Stripe */}
        <Card className={`cursor-pointer transition-all ${selectedMethod === "stripe" ? "ring-2 ring-blue-500" : ""}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CreditCard className="w-4 h-4" />
              Credit Card
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600 mb-3">Traditional payment processing</p>
            <Button onClick={handleStripeAlternative} size="sm" variant="outline" className="w-full" disabled>
              Coming Soon
            </Button>
            <p className="text-xs text-gray-500 mt-2">🚧 In development</p>
          </CardContent>
        </Card>
      </div>

      {/* Selected Method Details */}
      {selectedMethod === "crypto" && (
        <Card>
          <CardHeader>
            <CardTitle>Direct Crypto Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-gray-100 p-3 rounded">
              <p className="text-sm font-medium mb-2">Payment Address (Base Network):</p>
              <code className="text-xs break-all">0xYourPaymentAddress</code>
              <Button size="sm" variant="outline" className="ml-2">
                Copy
              </Button>
            </div>
            <div className="text-sm space-y-1">
              <p>
                <strong>Amount:</strong> $5 worth of ETH or USDC
              </p>
              <p>
                <strong>Network:</strong> Base (Chain ID: 8453)
              </p>
              <p>
                <strong>Note:</strong> Include your email in the transaction memo
              </p>
            </div>
            <p className="text-xs text-gray-500">
              After payment, email us at hello@kneadmag.com with your transaction hash for manual verification.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
