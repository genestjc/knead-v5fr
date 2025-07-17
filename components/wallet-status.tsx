"use client"

import { useState, useEffect } from "react"
import { WalletConnect } from "./wallet-connect"

export function WalletStatus() {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string>("")

  useEffect(() => {
    checkConnection()

    // Listen for account changes
    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged)
      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
      }
    }
  }, [])

  const checkConnection = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" })
        if (accounts.length > 0) {
          setIsConnected(true)
          setAddress(accounts[0])
        }
      } catch (error) {
        console.error("Error checking connection:", error)
      }
    }
  }

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length > 0) {
      setIsConnected(true)
      setAddress(accounts[0])
    } else {
      setIsConnected(false)
      setAddress("")
    }
  }

  if (isConnected) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="text-gray-600">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      </div>
    )
  }

  return <WalletConnect />
}
