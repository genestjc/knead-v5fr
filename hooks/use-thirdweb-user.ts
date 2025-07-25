"use client"

import { useActiveAccount } from "thirdweb/react"
import { useState, useEffect } from "react"

export function useThirdwebUser() {
  const account = useActiveAccount()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (account?.address) {
      // Try to get email from ThirdWeb account
      // This would depend on how ThirdWeb exposes user data
      // For now, we'll check if there's stored email data
      const storedEmail = localStorage.getItem(`email_${account.address}`)
      if (storedEmail) {
        setUserEmail(storedEmail)
      }
    } else {
      setUserEmail(null)
    }
  }, [account?.address])

  const saveUserEmail = (email: string) => {
    if (account?.address) {
      localStorage.setItem(`email_${account.address}`, email)
      setUserEmail(email)
    }
  }

  return {
    account,
    userEmail,
    isLoading,
    saveUserEmail,
  }
}
