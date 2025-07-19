"use client"

import { useEffect, useState } from "react"
import { ConnectButton, useActiveAccount } from "thirdweb/react"
import { getContract } from "thirdweb"
import { client } from "@/thirdweb-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Wallet, Shield, BookOpen, CreditCard, CheckCircle, XCircle } from "lucide-react"

const KNEAD_MEMBERSHIP_CONTRACT = {
  address: "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85",
  tokenIds: { freemium: 0, premium: 1 },
}
const CHAIN = "base"

export default function TestSandbox() {
  const account = useActiveAccount()
  const [hasFreemium, setHasFreemium] = useState(false)
  const [hasPremium, setHasPremium] = useState(false)
  const [readCount, setReadCount] = useState(0)
  const [readError, setReadError] = useState("")
  const [minting, setMinting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [premiumLoading, setPremiumLoading] = useState(false)
  const [trackingRead, setTrackingRead] = useState(false)
  const [mintError, setMintError] = useState("")

  useEffect(() => {
    if (!account) return
    setChecking(true)
    const checkNFTs = async () => {
      try {
        const contract = getContract({
          client,
          address: KNEAD_MEMBERSHIP_CONTRACT.address,
          chain: CHAIN,
        })

        const freemiumBalance = await contract.erc1155.balanceOf(
          account.address,
          KNEAD_MEMBERSHIP_CONTRACT.tokenIds.freemium,
        )
        const premiumBalance = await contract.erc1155.balanceOf(
          account.address,
          KNEAD_MEMBERSHIP_CONTRACT.tokenIds.premium,
        )

        setHasFreemium(Number(freemiumBalance) > 0)
        setHasPremium(Number(premiumBalance) > 0)
      } catch (error) {
        console.error("Error checking NFT balances:", error)
      }
      setChecking(false)
    }

    checkNFTs()
    fetchReadCount()
    // eslint-disable-next-line
  }, [account])

  const fetchReadCount = async () => {
    if (!account) return
    try {
      const res = await fetch("/api/track-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: account.address,
          checkOnly: true,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setReadCount(data.reads || 0)
      }
    } catch (error) {
      console.error("Error fetching read count:", error)
    }
  }

  const mintFreemium = async () => {
    if (!account) return
    setMinting(true)
    setMintError("")
    try {
      const res = await fetch("/api/mint-freemium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: account.address,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Mint failed")
      setHasFreemium(true)
      console.log("Freemium NFT minted successfully!")
    } catch (error: any) {
      setMintError(error.message || "Error minting freemium NFT")
      console.error("Error minting freemium NFT:", error)
    }
    setMinting(false)
  }

  const trackRead = async () => {
    if (!account) return
    setReadError("")
    setTrackingRead(true)

    try {
      const res = await fetch("/api/track-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: account.address,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setReadError(data.error || "Failed to track article read")
      } else {
        setReadCount(data.reads || 0)
        setReadError("")
      }
    } catch (error) {
      setReadError("Network error occurred")
      console.error("Error tracking read:", error)
    }
    setTrackingRead(false)
  }

  const startPremium = async () => {
    if (!account) return
    setPremiumLoading(true)

    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: account.address,
        }),
      })
      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        console.error("No checkout URL received")
      }
    } catch (error) {
      console.error("Error starting premium flow:", error)
    }
    setPremiumLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">Knead Magazine</h1>
          <p className="text-lg text-slate-600">Web3 Membership Test Sandbox</p>
        </div>

        {/* Wallet Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet Connection
            </CardTitle>
            <CardDescription>Connect your wallet to test the membership platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              <ConnectButton client={client} />
              {account && (
                <div className="text-center">
                  <p className="text-sm text-slate-600">Connected Address:</p>
                  <code className="text-sm bg-slate-100 px-2 py-1 rounded">{account.address}</code>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {account && (
          <>
            {/* NFT Ownership Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Membership Status
                  {checking && <Loader2 className="h-4 w-4 animate-spin" />}
                </CardTitle>
                <CardDescription>Your current NFT ownership on Base chain</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">Freemium NFT</h3>
                      <p className="text-sm text-slate-600">Token ID: 0</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasFreemium ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            Owned
                          </Badge>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-500" />
                          <Badge variant="secondary">Not Owned</Badge>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">Premium NFT</h3>
                      <p className="text-sm text-slate-600">Token ID: 1</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasPremium ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            Owned
                          </Badge>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-500" />
                          <Badge variant="secondary">Not Owned</Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Article Read Count */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Article Read Count
                </CardTitle>
                <CardDescription>Track your reading activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{readCount}</p>
                    <p className="text-sm text-slate-600">Articles read</p>
                  </div>
                  <Button onClick={trackRead} disabled={trackingRead} variant="outline">
                    {trackingRead && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Track New Read
                  </Button>
                </div>
                {readError && (
                  <Alert className="mt-4">
                    <AlertDescription className="text-red-600">{readError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mint Freemium */}
              <Card>
                <CardHeader>
                  <CardTitle>Mint Freemium NFT</CardTitle>
                  <CardDescription>Get your free membership NFT to start reading</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={mintFreemium} disabled={minting || hasFreemium} className="w-full" size="lg">
                    {minting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {hasFreemium ? "Already Owned" : "Mint Freemium NFT"}
                  </Button>
                  {mintError && (
                    <Alert className="mt-4">
                      <AlertDescription className="text-red-600">{mintError}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Upgrade to Premium */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Upgrade to Premium
                  </CardTitle>
                  <CardDescription>Unlock unlimited access with Stripe checkout</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={startPremium}
                    disabled={premiumLoading || hasPremium}
                    className="w-full"
                    size="lg"
                    variant={hasPremium ? "secondary" : "default"}
                  >
                    {premiumLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {hasPremium ? "Premium Active" : "Upgrade to Premium"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Contract Info */}
            <Card>
              <CardHeader>
                <CardTitle>Contract Information</CardTitle>
                <CardDescription>ERC1155 contract details for testing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Contract Address:</span>
                    <code className="ml-2 bg-slate-100 px-2 py-1 rounded">{KNEAD_MEMBERSHIP_CONTRACT.address}</code>
                  </div>
                  <div>
                    <span className="font-medium">Chain:</span>
                    <Badge variant="outline" className="ml-2">
                      Base
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Token IDs:</span>
                    <span className="ml-2">Freemium: 0, Premium: 1</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
