"use client"

import { useActiveAccount } from "thirdweb/react"
import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export function useUserRegistration() {
  const account = useActiveAccount()
  const [isRegistering, setIsRegistering] = useState(false)
  const [userType, setUserType] = useState<"new" | "freemium" | "premium" | null>(null)

  useEffect(() => {
    if (account?.address) {
      handleUserConnection(account.address)
    }
  }, [account?.address])

  const handleUserConnection = async (walletAddress: string) => {
    setIsRegistering(true)

    try {
      // Check if user already exists in our database
      const { data: existingUser, error } = await supabase
        .from("memberships")
        .select("*")
        .eq("wallet_address", walletAddress.toLowerCase())
        .single()

      if (existingUser) {
        // Existing user
        if (existingUser.status === "active" && existingUser.membership_type === "premium") {
          setUserType("premium")
        } else {
          setUserType("freemium")
        }
      } else {
        // New user - create freemium account and mint NFT
        await createFreemiumUser(walletAddress)
        setUserType("freemium")
      }
    } catch (error) {
      console.error("Error handling user connection:", error)
    } finally {
      setIsRegistering(false)
    }
  }

  const createFreemiumUser = async (walletAddress: string) => {
    try {
      // Call our API to create freemium user and mint NFT
      const response = await fetch("/api/create-freemium-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: walletAddress.toLowerCase(),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create freemium user")
      }

      const result = await response.json()
      console.log("Freemium user created:", result)
    } catch (error) {
      console.error("Error creating freemium user:", error)
    }
  }

  return {
    isRegistering,
    userType,
    isConnected: !!account?.address,
    walletAddress: account?.address,
  }
}
