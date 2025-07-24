"use client"

import { useEffect, useState } from "react"
import { useActiveAccount } from "thirdweb/react"

export function useMintFreemium(email: string) {
  const account = useActiveAccount()
  const [minted, setMinted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!account?.address || !email || minted) return

    setIsLoading(true)

    // Call your API to mint freemium token
    fetch("/api/mint-freemium", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_address: account.address,
        email,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMinted(true)
        }
      })
      .catch((error) => {
        console.error("Error minting freemium token:", error)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [account?.address, email, minted])

  return { minted, isLoading }
}
