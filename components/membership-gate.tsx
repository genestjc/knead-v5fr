"use client"

import type React from "react"
import { useMembership } from "./membership-provider"
import { ThirdWebConnectButton } from "./thirdweb-connect-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, Crown, Loader2 } from "lucide-react"
import Link from "next/link"

interface MembershipGateProps {
  children: React.ReactNode
  requiredTier?: "freemium" | "premium"
  fallback?: React.ReactNode
  showConnectButton?: boolean
}

export function MembershipGate({
  children,
  requiredTier = "freemium",
  fallback,
  showConnectButton = true,
}: MembershipGateProps) {
  const { membershipType, isLoading, walletAddress, hasAccess } = useMembership()

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="font-georgia-pro">Checking membership...</span>
        </div>
      </div>
    )
  }

  // Not connected to wallet
  if (!walletAddress) {
    return (
      fallback || (
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle className="font-adonis">Connect Wallet Required</CardTitle>
            <CardDescription className="font-georgia-pro">
              Please connect your wallet to access this content
            </CardDescription>
          </CardHeader>
          {showConnectButton && (
            <CardContent className="text-center">
              <ThirdWebConnectButton />
            </CardContent>
          )}
        </Card>
      )
    )
  }

  // Check if user has required access
  if (!hasAccess(requiredTier)) {
    return (
      fallback || (
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <Crown className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <CardTitle className="font-adonis">
              {requiredTier === "premium" ? "Premium Content" : "Membership Required"}
            </CardTitle>
            <CardDescription className="font-georgia-pro">
              {requiredTier === "premium"
                ? "This content requires a premium membership to access"
                : "This content requires a membership to access"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="font-georgia-pro">
              <Link href="/join">{requiredTier === "premium" ? "Upgrade to Premium" : "Get Membership"}</Link>
            </Button>
          </CardContent>
        </Card>
      )
    )
  }

  return <>{children}</>
}
