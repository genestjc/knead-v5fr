"use client"

import type React from "react"

import { useState } from "react"

export default function VipMint() {
  const [pw, setPw] = useState("")
  const [unlocked, setUnlocked] = useState(false)
  const [address, setAddress] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("")

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (pw === "sn1ckleFrItz!420_eQ3416B00B$") {
      setUnlocked(true)
    } else {
      setStatus("Incorrect password")
    }
  }

  async function handleMint(e: React.FormEvent) {
    e.preventDefault()
    setStatus("Minting...")

    const res = await fetch("/api/mint-vip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_address: address,
        email,
      }),
    })

    const data = await res.json()
    setStatus(data.success ? "Minted!" : data.error)
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
            />
            <button
              type="submit"
              className="w-full bg-black text-white py-2 px-4 rounded-md hover:bg-gray-800 transition-colors"
            >
              Unlock
            </button>
            {status && <div className="text-red-600 text-center">{status}</div>}
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
            className="w-full bg-black text-white py-2 px-4 rounded-md hover:bg-gray-800 transition-colors"
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
