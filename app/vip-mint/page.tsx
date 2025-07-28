"use client"

import type React from "react"
import { useState } from "react"

export default function VipMint() {
  const [pw, setPw] = useState("")
  const [unlocked, setUnlocked] = useState(false)
  const [address, setAddress] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [vipToken, setVipToken] = useState("")

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setStatus("")

    try {
      const response = await fetch("/api/verify-vip-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setUnlocked(true)
        setVipToken(data.token)
        setStatus("Access granted!")
      } else {
        if (response.status === 429) {
          setStatus(
            `Too many attempts. ${data.resetTime ? `Try again after ${new Date(data.resetTime).toLocaleTimeString()}` : "Please wait before trying again."}`,
          )
        } else {
          setStatus(data.error || "Access denied")
        }
      }
    } catch (error) {
      setStatus("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleMint(e: React.FormEvent) {
    e.preventDefault()
    setStatus("Minting...")

    try {
      const res = await fetch("/api/mint-vip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${vipToken}`,
        },
        body: JSON.stringify({
          user_address: address,
          email,
        }),
      })

      const data = await res.json()
      setStatus(data.success ? "Minted!" : data.error)
    } catch (error) {
      setStatus("Minting failed. Please try again.")
    }
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h1 className="text-2xl font-adonis mb-6 text-center">VIP Access</h1>
          <form onSubmit={handleUnlock} className="space-y-4">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="VIP password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !pw.trim()}
              className="w-full bg-black text-white py-2 px-4 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Verifying..." : "Unlock"}
            </button>
            {status && (
              <div
                className={`text-center text-sm ${status === "Access granted!" ? "text-green-600" : "text-red-600"}`}
              >
                {status}
              </div>
            )}
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-adonis mb-6 text-center">Mint VIP Token</h1>
        <form onSubmit={handleMint} className="space-y-4">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Wallet address"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!address.trim() || !email.trim()}
            className="w-full bg-black text-white py-2 px-4 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Mint VIP Token
          </button>
          {status && (
            <div className={`text-center ${status === "Minted!" ? "text-green-600" : "text-red-600"}`}>{status}</div>
          )}
        </form>
      </div>
    </div>
  )
}
