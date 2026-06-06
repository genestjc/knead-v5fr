"use client"

import React, { useState, useEffect, useRef, type TouchEvent } from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import { useActiveAccount } from "thirdweb/react"
import {
  Copy, LogOut, ArrowUpFromLine, Key, Wallet,
  DollarSign, Settings, Zap, Award, TrendingUp,
  Download, Check,
} from "lucide-react"
import { ThirdWebConnectButton } from "@/components/thirdweb-connect-button"
import { WalletSummary } from "@/components/wallet-summary"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
}

// ─── Swipeable Carousel ───────────────────────────────────────────────────────

interface SwipeableCarouselProps {
  images: string[]
  currentIndex: number
  setCurrentIndex: (fn: (prev: number) => number) => void
  height?: string
  className?: string
}

const SwipeableCarousel: React.FC<SwipeableCarouselProps> = ({
  images,
  currentIndex,
  setCurrentIndex,
  height = "400px",
  className = "",
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const minSwipeDistance = 50

  const prev = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setCurrentIndex((p) => (p === 0 ? images.length - 1 : p - 1))
  }
  const next = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setCurrentIndex((p) => (p + 1) % images.length)
  }
  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }
  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => setTouchEnd(e.targetTouches[0].clientX)
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    if (distance > minSwipeDistance) next()
    else if (distance < -minSwipeDistance) prev()
    setTouchStart(null)
    setTouchEnd(null)
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl ${className}`}
      style={{ height }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="absolute inset-0 w-full h-full">
        {images.map((img, i) => (
          <div
            key={i}
            className="absolute inset-0 w-full h-full transition-opacity duration-300"
            style={{ opacity: currentIndex === i ? 1 : 0, zIndex: currentIndex === i ? 1 : 0, pointerEvents: currentIndex === i ? "auto" : "none" }}
          >
            <Image src={img || "/placeholder.svg"} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
          </div>
        ))}
      </div>
      <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors z-10" aria-label="Previous" type="button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors z-10" aria-label="Next" type="button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 18L15 12L9 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {images.map((_, i) => (
          <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentIndex(() => i) }} className={`w-2 h-2 rounded-full transition-all duration-300 ${i === currentIndex ? "bg-white" : "bg-white/50"}`} aria-label={`Go to photo ${i + 1}`} type="button" />
        ))}
      </div>
    </div>
  )
}

// ─── Slide Wrapper ─────────────────────────────────────────────────────────

const Slide = ({
  id, children, slideRefs, setCurrentSlide, className = "", raw = false,
}: {
  id: number
  children: React.ReactNode
  slideRefs: React.MutableRefObject<(HTMLDivElement | null)[]>
  setCurrentSlide: (id: number) => void
  className?: string
  raw?: boolean
}) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = slideRefs.current[id]
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) { setCurrentSlide(id); setIsVisible(true) } }) },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.unobserve(el)
  }, [id, slideRefs, setCurrentSlide])

  if (raw) {
    return (
      <div ref={(el) => { slideRefs.current[id] = el }} className={`min-h-screen relative overflow-hidden ${className}`}>
        {children}
      </div>
    )
  }

  return (
    <div ref={(el) => { slideRefs.current[id] = el }} className={`min-h-screen flex items-center justify-center py-20 px-6 md:px-16 ${className}`}>
      <motion.div initial="hidden" animate={isVisible ? "visible" : "hidden"} variants={staggerContainer} className="w-full max-w-5xl">
        {children}
      </motion.div>
    </div>
  )
}

// ─── WalletSummaryDemo ────────────────────────────────────────────────────────

function WalletSummaryDemo({ state }: { state: "freemium" | "monthly" | "contributor" }) {
  const label = state === "contributor" ? "Contributor" : state === "monthly" ? "Knead Monthly" : "Freemium"

  return (
    <div className="inline-block text-left">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
          <Wallet className="w-3 h-3 text-gray-500" />
        </div>
        <span className="text-sm font-adonis text-black">0xa4f3...8c21</span>
        <span className="text-xs font-georgia-pro px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{label}</span>
      </div>

      <div className="w-60 bg-white border border-gray-200 rounded-lg shadow-xl">
        <div className="py-1">
          <div className="flex items-center px-4 py-2.5 text-sm font-adonis text-gray-700 hover:bg-gray-50 cursor-default">
            <Copy className="w-4 h-4 mr-2 text-gray-400" /> Copy Address
          </div>

          {state !== "freemium" && (
            <>
              <div className="border-t border-gray-100 my-1" />

              <div className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center text-sm font-adonis text-gray-700">
                  <Wallet className="w-4 h-4 mr-2 text-gray-400" /> Balance
                </div>
                <span className="text-sm font-adonis font-semibold text-gray-900">
                  {state === "contributor" ? "$24.80" : "$12.40"}
                </span>
              </div>

              {state === "contributor" && (
                <>
                  <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center text-sm font-adonis text-gray-700">
                      <Zap className="w-4 h-4 mr-2 text-gray-400" /> Weekly Allowance
                    </div>
                    <span className="text-sm font-adonis font-semibold text-blue-600">$67.50 / $100</span>
                  </div>

                  <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center text-sm font-adonis text-gray-700">
                      <DollarSign className="w-4 h-4 mr-2 text-gray-400" /> Claimable
                    </div>
                    <span className="text-sm font-adonis font-semibold text-green-600">$12.40</span>
                  </div>

                  <div className="flex items-center px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-green-50 cursor-default">
                    <Download className="w-4 h-4 mr-2 text-gray-400" /> Claim USDC
                  </div>
                </>
              )}

              {state === "monthly" && (
                <>
                  <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center text-sm font-adonis text-gray-700">
                      <Award className="w-4 h-4 mr-2 text-gray-400" /> Total Earned
                    </div>
                    <span className="text-sm font-adonis font-semibold text-gray-900">$47.20</span>
                  </div>

                  <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center text-sm font-adonis text-gray-700">
                      <TrendingUp className="w-4 h-4 mr-2 text-gray-400" /> Progress
                    </div>
                    <span className="text-sm font-adonis font-semibold text-purple-600">$47.20 / $100</span>
                  </div>

                  <div className="px-4 py-2">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: "47.2%" }} />
                    </div>
                    <p className="text-xs font-georgia-pro text-gray-400 mt-1">$52.80 more to graduate to Contributor</p>
                  </div>
                </>
              )}

              <div className="flex items-center px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-50 cursor-default">
                <ArrowUpFromLine className="w-4 h-4 mr-2 text-gray-400" /> Send USDC
              </div>

              <div className="border-t border-gray-100 my-1" />

              {state === "contributor" && (
                <div className="flex items-center px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-50 cursor-default">
                  <Settings className="w-4 h-4 mr-2 text-gray-400" /> Contributor Settings
                </div>
              )}

              <div className="flex items-center px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-50 cursor-default">
                <Key className="w-4 h-4 mr-2 text-gray-400" /> Export Private Key
              </div>
            </>
          )}

          <div className="border-t border-gray-100 my-1" />

          <div className="flex items-center px-4 py-2 text-sm font-adonis text-gray-700 hover:bg-gray-50 cursor-default">
            <LogOut className="w-4 h-4 mr-2 text-gray-400" /> Sign Out
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ConstantPracticeDemo ─────────────────────────────────────────────────────

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function DemoPaymentForm({ onSuccess }: { onSuccess: (id: string) => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setIsProcessing(true)
    setErrorMessage(null)
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required" })
    if (error) { setErrorMessage(error.message || "An error occurred."); setIsProcessing(false); return }
    if (paymentIntent?.id) onSuccess(paymentIntent.id)
    else { setErrorMessage("Payment completed but no intent returned."); setIsProcessing(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{ layout: "tabs" }} />
      {errorMessage && <p className="text-red-600 text-sm font-georgia-pro">{errorMessage}</p>}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-black text-white px-6 py-3 rounded font-adonis text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? "Processing..." : "Join Today"}
      </button>
    </form>
  )
}

function ConstantPracticeDemo() {
  const account = useActiveAccount()
  const [isLoadingIntent, setIsLoadingIntent] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentDone, setPaymentDone] = useState(false)

  const handleSubscribe = async () => {
    if (!account?.address) return
    setIsLoadingIntent(true)
    try {
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: account.address, amount: 500 }),
      })
      const data = await res.json()
      if (data.clientSecret) { setClientSecret(data.clientSecret); setIsModalOpen(true) }
    } finally {
      setIsLoadingIntent(false)
    }
  }

  const stripeOptions = clientSecret ? {
    clientSecret,
    appearance: {
      theme: "stripe" as const,
      variables: { colorPrimary: "#000000", colorBackground: "#ffffff", fontFamily: '"Georgia Pro", Georgia, serif' },
    },
  } : null

  return (
    <div className="max-w-md border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
      <div className="relative w-full" style={{ height: "200px" }}>
        <Image src="/constant-practice-photo.jpg" alt="Constant Practice" fill className="object-cover" />
      </div>
      <div className="px-5 pt-4 pb-2">
        <h3 className="font-adonis text-lg text-black mb-1">Constant Practice</h3>
        <p className="font-georgia-pro text-xs text-gray-500 italic mb-3">
          With vintage luxury more sought-after than ever, how does one of the most popular curators separate itself from the pack?
        </p>
        <div className="relative overflow-hidden" style={{ maxHeight: "100px" }}>
          <p className="font-georgia-pro text-sm text-gray-700 leading-relaxed mb-2">
            &ldquo;It&apos;s like looking at art - everyone will have their own opinion and be drawn to something different, so we don&apos;t hope to convey anything in particular, we just like sharing.&rdquo;
          </p>
          <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-white to-transparent" />
        </div>
      </div>

      <div className="px-5 pb-3 pt-2">
        {paymentDone ? (
          <p className="font-adonis text-sm text-green-600 text-center py-3">Payment verified — welcome to Knead Monthly!</p>
        ) : !account?.address ? (
          <div className="bg-white border border-gray-200 rounded-lg p-5 text-center shadow-sm">
            <h2 className="font-adonis text-base text-black mb-1">You&apos;ve reached your story limit for the month.</h2>
            <p className="font-georgia-pro italic text-gray-600 text-xs mb-4">Want unlimited access?</p>
            <div className="flex justify-center">
              <ThirdWebConnectButton />
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-5 text-center shadow-sm">
            <h2 className="font-adonis text-base text-black mb-1">You&apos;ve reached your story limit for the month.</h2>
            <p className="font-georgia-pro italic text-gray-600 text-xs mb-4">Want unlimited access?</p>
            <button
              onClick={handleSubscribe}
              disabled={isLoadingIntent}
              className="bg-black text-white px-5 py-2.5 rounded font-adonis text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 w-full"
            >
              {isLoadingIntent ? "Loading..." : "Subscribe to Knead Monthly — $5/mo"}
            </button>
          </div>
        )}
      </div>

      <p className="px-5 pb-4 font-georgia-pro text-xs text-gray-600 italic text-center font-semibold">
        Disclaimer: This is a live paywall and will charge your card if you click &ldquo;Join Today&rdquo;
      </p>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-adonis text-xl text-center">Subscribe to Knead Monthly</DialogTitle>
            <DialogDescription className="font-georgia-pro text-sm text-center text-gray-600">
              Complete your payment to get unlimited access to all Knead stories
            </DialogDescription>
          </DialogHeader>
          {clientSecret && stripeOptions && (
            <Elements stripe={stripePromise} options={stripeOptions}>
              <DemoPaymentForm onSuccess={(id) => { setPaymentDone(true); setIsModalOpen(false) }} />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── DonutChart ──────────────────────────────────────────────────────────

function DonutChart() {
  const data = [
    { label: "Team", value: 144780, color: "#C17A4A", note: "3 people, 6 months" },
    { label: "Treasury", value: 90000, color: "#8B5E35", note: "Tips + Demeter activities" },
    { label: "Consultants", value: 73500, color: "#7B9068", note: "Dev, editorial, legal, accounting" },
    { label: "Operations", value: 26500, color: "#C8A87A", note: "Infra, coworking, travel" },
    { label: "Activations", value: 27000, color: "#B5705A", note: "Clothing, print, dinner, investor gifts" },
  ]
  const total = 361780

  const cx = 110, cy = 110, r = 90, ir = 52
  const toRad = (deg: number) => (deg * Math.PI) / 180

  let cursor = 0
  const segments = data.map((item) => {
    const pct = item.value / total
    const startDeg = cursor * 360
    const endDeg = (cursor + pct) * 360
    cursor += pct

    const s = startDeg - 90
    const e = endDeg - 90
    const x1 = cx + r * Math.cos(toRad(s))
    const y1 = cy + r * Math.sin(toRad(s))
    const x2 = cx + r * Math.cos(toRad(e))
    const y2 = cy + r * Math.sin(toRad(e))
    const ix1 = cx + ir * Math.cos(toRad(s))
    const iy1 = cy + ir * Math.sin(toRad(s))
    const ix2 = cx + ir * Math.cos(toRad(e))
    const iy2 = cy + ir * Math.sin(toRad(e))
    const large = endDeg - startDeg > 180 ? 1 : 0

    return {
      ...item,
      pct: Math.round(pct * 1000) / 10,
      path: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${ir} ${ir} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z`,
    }
  })

  return (
    <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">
      <div className="flex-shrink-0">
        <svg width="220" height="220" viewBox="0 0 220 220" className="overflow-visible">
          {segments.map((seg, i) => (
            <path key={i} d={seg.path} fill={seg.color} stroke="white" strokeWidth="2" />
          ))}
          <text x={cx} y={cy - 8} textAnchor="middle" style={{ fontFamily: '"adonis-web", serif', fontSize: 13, fill: "#111" }}>
            Total Ask
          </text>
          <text x={cx} y={cx + 10} textAnchor="middle" style={{ fontFamily: '"Georgia Pro", Georgia, serif', fontSize: 12, fill: "#555" }}>
            $361,780
          </text>
        </svg>
      </div>

      <div className="space-y-4 w-full md:w-auto">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <div>
              <div className="flex items-baseline gap-2">
                <p className="font-adonis text-sm text-black">{seg.label}</p>
                <p className="font-georgia-pro text-xs text-gray-500">{seg.pct}%</p>
              </div>
              <p className="font-adonis text-base text-black">${seg.value.toLocaleString()}</p>
              <p className="font-georgia-pro text-xs text-gray-500 mt-0.5">{seg.note}</p>
            </div>
          </div>
        ))}
        <div className="pt-3 border-t border-gray-200">
          <p className="font-georgia-pro text-xs text-gray-400 italic">Recommended raise: $375K–$400K</p>
        </div>
      </div>
    </div>
  )
}

// ─── Community Round Calculator ───────────────────────────────────────────────

function CommunityRoundCalculator() {
  const [amount, setAmount] = useState("")
  const CAP = 2000000
  const pct = amount && parseInt(amount) > 0
    ? ((parseInt(amount) / CAP) * 100).toFixed(4)
    : null

  return (
    <div className="space-y-3">
      <p className="font-georgia-pro text-xs text-gray-400">Estimate your ownership at the $2M cap:</p>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-adonis text-gray-400 text-sm">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-white/10 border border-white/30 rounded-lg pl-7 pr-3 py-2.5 font-georgia-pro text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/60"
            placeholder="Investment amount"
          />
        </div>
        {pct && (
          <div className="bg-white/20 rounded-lg px-4 py-2.5 min-w-[90px] text-center">
            <p className="font-adonis text-white text-sm">~{pct}%</p>
          </div>
        )}
      </div>
      {pct && (
        <p className="font-georgia-pro text-xs text-gray-400 italic">
          At the $2M post-money cap, ${parseInt(amount).toLocaleString()} converts to approximately {pct}% of Knead.
        </p>
      )}
    </div>
  )
}

// ─── SAFE Investor Form ───────────────────────────────────────────────────────

type SAFEFormState = "form" | "submitted" | "payment"

function SAFEInvestorForm() {
  const [state, setState] = useState<SAFEFormState>("form")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"usdc" | "wire" | "ach" | null>(null)
  const [form, setForm] = useState({
    name: "", email: "", amount: "", address: "",
    accredited: "accredited" as "accredited" | "unaccredited",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      // POST to /api/safe-submission — sends Resend notification to Joe,
      // queues Dropbox Sign pre-signed SAFE to investor email
      await fetch("/api/safe-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      setState("submitted")
    } catch {
      // still advance — notification fires server-side
      setState("submitted")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (state === "payment") {
    return (
      <div className="space-y-8">
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
          <p className="font-adonis text-sm text-gray-400 uppercase tracking-widest mb-1">Your investment</p>
          <p className="font-adonis text-3xl text-black">${parseInt(form.amount || "0").toLocaleString()}</p>
          <p className="font-georgia-pro text-sm text-gray-500 mt-1">SAFE · $1,500,000 cap · 20% discount</p>
        </div>

        <p className="font-adonis text-lg text-black">Choose your payment method:</p>

        <div className="grid md:grid-cols-3 gap-4">
          {(["usdc", "wire", "ach"] as const).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setPaymentMethod(method)}
              className={`p-5 rounded-xl border-2 text-left transition-all ${paymentMethod === method ? "border-black bg-black text-white" : "border-gray-200 hover:border-gray-400 bg-white"}`}
            >
              <p className="font-adonis text-base mb-1">
                {method === "usdc" ? "USDC" : method === "wire" ? "Wire Transfer" : "ACH Transfer"}
              </p>
              <p className={`font-georgia-pro text-xs ${paymentMethod === method ? "text-gray-300" : "text-gray-500"}`}>
                {method === "usdc" ? "Instant · Base L2" : method === "wire" ? "1–2 business days" : "1–3 business days"}
              </p>
            </button>
          ))}
        </div>

        {paymentMethod === "usdc" && (
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 space-y-3">
            <p className="font-adonis text-sm text-black">Send USDC on Base L2</p>
            <p className="font-georgia-pro text-sm text-gray-600">Amount: <strong>{form.amount} USDC</strong></p>
            <p className="font-georgia-pro text-xs text-gray-500 break-all">
              Wallet: <strong className="font-adonis text-black">0xe0c1EeBc42553C2a814905E5f73e5Fde2c52D8Fa</strong>
            </p>
            <p className="font-georgia-pro text-xs text-gray-400 italic">
              Include your email address in the memo. Your SAFE will be sent once payment is confirmed on-chain.
            </p>
          </div>
        )}

        {(paymentMethod === "wire" || paymentMethod === "ach") && (
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 space-y-3">
            <p className="font-adonis text-sm text-black">
              {paymentMethod === "wire" ? "Wire Transfer Details" : "ACH Transfer Details"}
            </p>
            <div className="space-y-2 font-georgia-pro text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Bank</span><span className="font-adonis text-black">Bluevine (Coastal Community Bank)</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Account name</span><span className="font-adonis text-black">Knead Publishing LLC</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Routing number</span><span className="font-adonis text-black">083974433</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Account number</span><span className="font-adonis text-black">[Your Bluevine account #]</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-adonis text-black">${parseInt(form.amount || "0").toLocaleString()}.00</span></div>
            </div>
            <p className="font-georgia-pro text-xs text-gray-400 italic">
              Include your name and email in the memo line. Your SAFE will be countersigned and returned once payment clears.
            </p>
          </div>
        )}
      </div>
    )
  }

  if (state === "submitted") {
    return (
      <div className="space-y-8">
        <div className="bg-black rounded-xl p-8 text-white text-center space-y-4">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto">
            <Check className="w-6 h-6 text-black" strokeWidth={3} />
          </div>
          <h3 className="font-adonis text-2xl">You&apos;re in the queue.</h3>
          <p className="font-georgia-pro text-gray-300 text-base">
            We&apos;ll review your submission and send your SAFE to <strong className="text-white">{form.email}</strong> within 24 hours. Check your inbox for a DocuSign link.
          </p>
        </div>
        <div className="text-center">
          <button
            type="button"
            onClick={() => setState("payment")}
            className="font-adonis text-sm text-black underline underline-offset-4 hover:text-gray-600 transition-colors"
          >
            Ready to send payment now? →
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className="font-adonis text-xs text-gray-400 uppercase tracking-widest block mb-2">Full Name</label>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 font-georgia-pro text-base text-black focus:outline-none focus:border-black transition-colors"
            placeholder="Your full name"
          />
        </div>
        <div>
          <label className="font-adonis text-xs text-gray-400 uppercase tracking-widest block mb-2">Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 font-georgia-pro text-base text-black focus:outline-none focus:border-black transition-colors"
            placeholder="you@email.com"
          />
        </div>
      </div>

      <div>
        <label className="font-adonis text-xs text-gray-400 uppercase tracking-widest block mb-2">Investment Amount</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-adonis text-gray-400">$</span>
          <input
            required
            type="number"
            min="1000"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg pl-8 pr-4 py-3 font-georgia-pro text-base text-black focus:outline-none focus:border-black transition-colors"
            placeholder="1,000 minimum"
          />
        </div>
        {form.amount && parseInt(form.amount) >= 1000 && (
          <p className="font-georgia-pro text-xs text-gray-500 mt-1 italic">
            At the $1.5M cap, ${parseInt(form.amount).toLocaleString()} ≈ {((parseInt(form.amount) / 1500000) * 100).toFixed(3)}% of Knead
          </p>
        )}
      </div>

      <div>
        <label className="font-adonis text-xs text-gray-400 uppercase tracking-widest block mb-2">Address</label>
        <input
          required
          type="text"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 font-georgia-pro text-base text-black focus:outline-none focus:border-black transition-colors"
          placeholder="Street address, city, state, ZIP"
        />
      </div>

      <div>
        <label className="font-adonis text-xs text-gray-400 uppercase tracking-widest block mb-3">Investor Status</label>
        <div className="flex gap-4">
          {(["accredited", "unaccredited"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setForm((f) => ({ ...f, accredited: type }))}
              className={`flex-1 py-3 px-4 rounded-lg border-2 font-adonis text-sm transition-all ${
                form.accredited === type ? "border-black bg-black text-white" : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {type === "accredited" ? "Accredited Investor" : "Unaccredited Investor"}
            </button>
          ))}
        </div>
        <p className="font-georgia-pro text-xs text-gray-400 mt-2 italic">
          Accredited: $200K+ annual income or $1M+ net worth (excl. primary residence)
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-black text-white py-4 rounded-xl font-adonis text-base hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Submitting…" : "Submit — We'll Send Your SAFE Within 24 Hours"}
      </button>

      <p className="font-georgia-pro text-xs text-gray-400 text-center italic">
        This raise is conducted under Reg D 506(b). This form is only for people with a pre-existing relationship with Knead. SAFE terms: $1,500,000 post-money valuation cap · 20% discount · Minimum $1,000.
      </p>
    </form>
  )
}

// ─── Mock Paywall Demo (no auth required) ────────────────────────────────────

function MockPaywallDemo() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden max-w-sm w-full">
      <div className="relative w-full" style={{ height: "180px" }}>
        <Image src="/nisei-kitchen-blvck-svm.jpg" alt="Story preview" fill className="object-cover" />
      </div>
      <div className="p-5">
        <p className="font-adonis text-base text-black mb-1">Constant Practice</p>
        <p className="font-georgia-pro text-xs text-gray-500 italic mb-4">With vintage luxury more sought-after than ever, how does one of the most popular curators separate itself from the pack?</p>
        <p className="font-georgia-pro text-xs text-gray-600 mb-4 line-clamp-2">&ldquo;It&apos;s like looking at art — everyone will have their own opinion and be drawn to something different, so we don&apos;t hope to convey anything in particular, we just like sharing.&rdquo;</p>
        <div className="border border-gray-200 rounded-lg p-4 text-center bg-gray-50">
          <p className="font-adonis text-sm text-black mb-1">You&apos;ve reached your story limit for the month.</p>
          <p className="font-georgia-pro text-xs text-gray-500 italic mb-3">Want unlimited access?</p>
          <a
            href="https://www.kneadmag.com/join"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-black text-white font-adonis text-sm py-2.5 rounded hover:bg-gray-800 transition-colors text-center"
          >
            Subscribe to Knead Monthly — $5/mo
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────

const TOTAL_SLIDES = 15

export default function Knead20PitchPage() {
  const account = useActiveAccount()
  const [currentSlide, setCurrentSlide] = useState(0)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])

  const dinnerPartyPhotos = [
    "/dinner-party-1.jpg", "/dinner-party-2.jpg", "/dinner-party-3.jpg",
    "/dinner-party-4.jpg", "/dinner-party-5.jpg", "/dinner-party-6.jpg",
    "/dinner-party-7.jpg",
  ]
  const [currentDinnerPhoto, setCurrentDinnerPhoto] = useState(0)

  const scrollToSlide = (index: number, e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    setCurrentSlide(index)
    slideRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const slideProps = { slideRefs, setCurrentSlide }

  // Restore slide position after ThirdWeb wallet connect redirect
  useEffect(() => {
    const saved = sessionStorage.getItem('knead-deck-slide')
    if (saved !== null) {
      const idx = parseInt(saved)
      sessionStorage.removeItem('knead-deck-slide')
      setTimeout(() => scrollToSlide(idx), 600)
    }
  }, [])

  const handleConnectClick = () => {
    sessionStorage.setItem('knead-deck-slide', currentSlide.toString())
  }

  return (
    <div className="bg-white text-black overflow-x-hidden">

      {/* ── Navigation Dots ─────────────────────────────────────────────────── */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden md:block">
        <div className="flex flex-col gap-3">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button
              key={i}
              onClick={(e) => scrollToSlide(i, e)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                currentSlide === i ? "bg-black scale-125" : "bg-gray-300 hover:bg-gray-500"
              }`}
              aria-label={`Go to slide ${i + 1}`}
              type="button"
            />
          ))}
        </div>
      </div>

      {/* ── Slide 0: Title ───────────────────────────────────────────────────── */}
      <Slide id={0} {...slideProps} className="bg-white">
        <div className="text-center max-w-4xl mx-auto">
          <motion.h1
            variants={fadeIn}
            className="font-adonis text-[7rem] md:text-[10rem] lg:text-[13rem] text-black leading-none"
          >
            Knead
          </motion.h1>
          <motion.p
            variants={fadeIn}
            className="font-georgia-pro text-xl md:text-2xl text-gray-500 italic mt-6"
          >
            FF Deck (Private)
          </motion.p>
          <motion.p variants={fadeIn} className="font-georgia-pro text-sm text-gray-400 mt-16">Scroll to explore ↓</motion.p>
        </div>
      </Slide>

      {/* ── Slide 1: The Internet + Problem (combined) ───────────────────────── */}
      <Slide id={1} {...slideProps} raw className="bg-gray-900">
        <div className="relative min-h-screen flex items-center">
          <div className="absolute inset-0">
            <Image
              src="/Knead Mag - 4.8.24 - Select 01.jpg"
              alt="Knead editorial"
              fill
              className="object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 max-w-4xl px-6 md:px-16 py-20 mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="font-adonis text-4xl md:text-6xl lg:text-7xl text-white mb-14 leading-tight"
            >
              We&apos;ve lost the art of being premium online.
            </motion.h1>
            <div className="space-y-7">
              {[
                "Stadium-status musicians are using Linktree as their main website.",
                "Best-selling authors are promoting the same formulaically-designed Substack for their prose.",
                "Well-respected interviewers are stopping thought-provoking conversations to ask for Patreon donations.",
                "None of this was a part of our childhood dreams.",
                "It's time we take ownership of making the internet fun again.",
              ].map((line, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.3 + i * 0.18, ease: "easeOut" }}
                  className={`font-georgia-pro text-lg md:text-xl leading-relaxed ${
                    i >= 3 ? "text-white font-semibold" : "text-gray-300"
                  }`}
                >
                  {line}
                </motion.p>
              ))}
            </div>
          </div>
        </div>
      </Slide>

      {/* ── Slide 2: Knead 2.0 Intro ────────────────────────────────────────── */}
      <Slide id={2} {...slideProps} raw className="bg-white">
        <div className="absolute inset-0">
          <Image
            src="/chatlayout.png"
            alt="Knead chat interface"
            fill
            className="object-cover opacity-20"
          />
        </div>
        <div className="relative z-10 min-h-screen flex flex-col justify-between px-6 md:px-16 py-20">
          <div className="text-center max-w-3xl mx-auto flex-1 flex flex-col items-center justify-center">
            <h2 className="font-adonis text-5xl md:text-7xl lg:text-8xl text-black mb-16">
              Knead 2.0
            </h2>
            <p className="font-georgia-pro text-lg md:text-xl text-black max-w-2xl mx-auto">
              Knead is a media and community platform with paywalled articles, live streaming, video premieres, a gamified chat, &amp; more.
            </p>
          </div>

        </div>
      </Slide>

      {/* ── Slide 3: Our Stories ─────────────────────────────────────────────── */}
      <Slide id={3} {...slideProps} raw className="bg-gray-900">
        <div className="absolute inset-0">
          <Image
            src="/nisei-kitchen-blvck-svm.jpg"
            alt="Our Stories"
            fill
            className="object-cover opacity-60"
          />
        </div>
        <div className="relative z-10 min-h-screen flex items-center justify-center py-20 px-6 md:px-16">
          <div className="w-full max-w-4xl">
            <h2 className="font-adonis text-4xl md:text-5xl text-white mb-10">
              Our Stories
            </h2>
            <div className="space-y-5 font-georgia-pro text-lg md:text-xl text-white max-w-3xl">
              <p>Knead&apos;s writing is focused on original interviews with the most inspiring minds across an array of disciplines, including art, music, technology, food, fashion, and others.</p>
              <p>We pride ourselves on original work, prioritizing organic photography, illustration, design, and film.</p>
              <p>Our rich storytelling is aimed to nourish the creative spirit, inspiring that someone can start &lsquo;kneading&rsquo; for themselves too.</p>
            </div>
          </div>
        </div>
      </Slide>

      {/* ── Slide 4: How Knead's Community Works ────────────────────────────── */}
      <Slide id={4} {...slideProps} raw className="bg-gray-50">
        <div className="relative min-h-screen py-20 px-6 md:px-16">
          <div className="absolute inset-0">
            <Image src="/chatbackground2.png" alt="Community background" fill className="object-cover" />
            <div className="absolute inset-0 bg-white/75" />
          </div>
          <div className="relative z-10 max-w-5xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              className="font-adonis text-4xl md:text-5xl text-black mb-12 text-center"
            >
              How Knead&apos;s Community Works
            </motion.h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  tier: "Tier 03 · Highest Status",
                  name: "Contributor",
                  items: [
                    "Influencers, interview subjects, photographers, industry experts",
                    "Highest status in Knead's chat",
                    "Vote on Demeter proposals",
                    "Can tell Demeter to send Knead Monthly members merchandise from store",
                    "Can tip on Knead Monthly member comments, earning 20% cashback",
                  ],
                },
                {
                  tier: "Tier 02",
                  name: "Knead Monthly",
                  items: [
                    "Pays $5/month for unlimited viewing",
                    "Can comment during events",
                    "Earns tips from Contributors for good comments",
                    "Eligible to submit Demeter proposals for community funding",
                    "Can receive Demeter gifts from Contributors",
                  ],
                },
                {
                  tier: "Tier 01",
                  name: "Free",
                  items: [
                    "Watch live events like interviews or DJ sets for one hour",
                    "Read-only access to community chat",
                    "Entry point to the Knead ecosystem",
                  ],
                },
              ].map((col, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                  <p className="font-adonis text-xs text-gray-400 uppercase tracking-widest mb-1">{col.tier}</p>
                  <h3 className="font-adonis text-3xl mb-4 pb-4 border-b border-black text-black">{col.name}</h3>
                  <ul className="space-y-3">
                    {col.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2">
                        <span className="text-black mt-1.5 flex-shrink-0 text-xs">●</span>
                        <p className="font-georgia-pro text-sm text-gray-700">{item}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Slide>

      {/* ── Slide 5: The Knead Membership ───────────────────────────────────── */}
      <Slide id={5} {...slideProps} className="bg-white">
        <div className="max-w-5xl grid md:grid-cols-2 gap-12 items-center">
          <div>
            <motion.h2 variants={fadeIn} className="font-adonis text-4xl md:text-5xl text-black mb-8">
              The Knead Membership
            </motion.h2>
            <motion.div variants={staggerContainer} className="space-y-5 font-georgia-pro text-lg text-gray-700">
              <motion.p variants={fadeIn}>
                Everyone who signs into Knead gets a free membership, complete with three free stories per month and an hour of chat event viewing.
              </motion.p>
              <motion.div variants={fadeIn} className="my-2" onClick={handleConnectClick}>
                {account ? <WalletSummary /> : <ThirdWebConnectButton />}
              </motion.div>
              <motion.p variants={fadeIn}>
                Upgrading a membership takes less than a minute and accepts Apple/Google Pay. Here&apos;s what it includes:
              </motion.p>
              <motion.div variants={fadeIn} className="bg-gray-50 rounded-xl border border-gray-100 p-5">
                <div className="flex items-baseline gap-3 mb-3">
                  <p className="font-adonis text-base text-black">Knead Monthly</p>
                  <p className="font-adonis text-2xl text-black">$5<span className="text-sm text-gray-500">/mo</span></p>
                </div>
                <ul className="space-y-2">
                  {[
                    "Unlimited access to stories and chat events.",
                    "Create a chat alias.",
                    "Participate and comment during chat events.",
                    "Receive tips from Contributors in the chat.",
                    "Submit Demeter proposals in the chat.",
                    "Receive gifts from Contributors in the chat.",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 font-georgia-pro text-sm text-gray-700">
                      <span className="text-black mt-1.5 flex-shrink-0 text-xs">●</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </motion.div>
          </div>
          <motion.div variants={fadeIn} className="flex flex-col items-center">
            <p className="font-adonis text-xs text-gray-400 uppercase tracking-widest mb-3">When the limit is reached</p>
            <MockPaywallDemo />
          </motion.div>
        </div>
      </Slide>

      {/* ── Slide 6: The Chat ────────────────────────────────────────────────── */}
      <Slide id={6} {...slideProps} className="bg-white">
        <div className="max-w-5xl grid md:grid-cols-2 gap-12 items-center">
          <div>
            <motion.h2 variants={fadeIn} className="font-adonis text-4xl md:text-5xl text-black mb-8">
              The Chat
            </motion.h2>
            <motion.div variants={staggerContainer} className="space-y-5 font-georgia-pro text-lg text-gray-700">
              <motion.p variants={fadeIn}>Knead&apos;s chat is our hub for community.</motion.p>
              <motion.p variants={fadeIn}>It&apos;s capable of hosting a wide range of events, including:</motion.p>
              <motion.ul variants={fadeIn} className="space-y-3 pl-2">
                <li className="flex items-start gap-3">
                  <span className="text-black mt-1.5 flex-shrink-0 text-xs">●</span>
                  <span><strong className="text-black font-adonis">Livestreams:</strong> Includes guest takeovers + music mode (for high-quality audio). Perfect for interviews, DJ sets, and more.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-black mt-1.5 flex-shrink-0 text-xs">●</span>
                  <span><strong className="text-black font-adonis">Video Upload:</strong> Movies, music videos, interviews, and other content to premiere.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-black mt-1.5 flex-shrink-0 text-xs">●</span>
                  <span><strong className="text-black font-adonis">Private Events:</strong> Gate the chat&apos;s functionality exclusively for niche community events, like students or nonprofits.</span>
                </li>
              </motion.ul>
              <motion.p variants={fadeIn}>
                The chat&apos;s membership tiers are designed for a gamified experience. Knead Members earn tips/rewards, engage with high-quality guests, and earn their way into top-level status as a Contributor.
              </motion.p>
            </motion.div>
          </div>
          <motion.div variants={fadeIn} className="flex justify-center">
            <div className="relative w-full rounded-xl overflow-hidden shadow-lg" style={{ height: "500px" }}>
              <Image src="/chat-interface-example.png" alt="Knead chat interface" fill style={{ objectPosition: "center 12%" }} className="object-cover" />
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* ── Slide 7: Meet Demeter ────────────────────────────────────────────── */}
      <Slide id={7} {...slideProps} raw className="bg-white">
        <div className="min-h-screen py-20 px-6 md:px-16">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <motion.h2
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
                  className="font-adonis text-4xl md:text-5xl text-black mb-2"
                >
                  Meet Demeter
                </motion.h2>
                <p className="font-georgia-pro text-lg text-gray-500 italic mb-8">Knead&apos;s Agentic Companion</p>
                <div className="space-y-6 font-georgia-pro text-base text-gray-700">
                  <p>
                    Demeter (named after the Goddess of Harvest) lives in Knead&apos;s chat as our agent. Accessible to admin and Contributors, Demeter serves a few functions:
                  </p>
                  {[
                    {
                      title: "Funding creator proposals",
                      body: "Our creator program runs autonomously via Demeter. A Knead Monthly member sends a proposal in our chat's menu (e.g. \"I want paint for this mural.\"), Contributors vote throughout the week, and Demeter automatically buys and ships the materials — plus sends USDC for labor.",
                    },
                    {
                      title: "Gifting merchandise",
                      body: "Contributors can gift Knead Monthly members with merchandise for making good comments, which doubles as a membership via our NFC-enabled products.",
                    },
                    {
                      title: "Contributor rewards",
                      body: "Certain limited-run giveaways will only be available to Contributors, who tag Demeter to claim items.",
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-black mt-1.5 flex-shrink-0 text-xs">●</span>
                      <div>
                        <p className="font-adonis text-base text-black mb-1">{item.title}</p>
                        <p className="font-georgia-pro text-sm text-gray-600">{item.body}</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-gray-500 italic text-sm">
                    As we grow our community, we look forward to building more agentic solutions to serve them.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-4 pt-4">
                <p className="font-adonis text-xs text-gray-400 uppercase tracking-widest">Demeter in action</p>
                <div className="relative w-full rounded-xl overflow-hidden shadow-lg border border-gray-100" style={{ minHeight: "520px" }}>
                  <Image
                    src="/Demeter Example.png"
                    alt="Demeter agentic companion in Knead chat"
                    fill
                    className="object-cover object-center"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Slide>

      {/* ── Slide 8: Knead As An Agency ─────────────────────────────────────── */}
      <Slide id={8} {...slideProps} raw className="bg-black">
        <div className="relative min-h-screen">
          <div className="absolute inset-0">
            <Image
              src="/Tarantula-04.jpg"
              alt="Knead As An Agency"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/60" />
          </div>
          <div className="relative z-10 min-h-screen flex flex-col items-center justify-center py-20 px-6 md:px-16">
            <div className="w-full max-w-5xl">
              <div className="text-center mb-16 pt-12">
                <h2 className="font-adonis text-4xl md:text-6xl text-white mb-6">Knead As An Agency</h2>
                <p className="font-georgia-pro text-xl md:text-2xl text-white/90 mb-2">Every company&apos;s a media company.</p>
                <p className="font-georgia-pro text-lg text-white/70">We build the solutions for you to own how it engages with your community.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { name: "Platform", desc: "Own how your content is distributed from day one." },
                  { name: "Community", desc: "Build systems that turn your audience into a community — and rewards them for it." },
                  { name: "Intelligence", desc: "Put AI to work across editorial, commerce, or community." },
                  { name: "Story", desc: "Uncover where your message is missing its audience." },
                  { name: "Commerce", desc: "Agentic solutions that reward communities and reduce empty carts." },
                ].map((service, i) => (
                  <div
                    key={i}
                    className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 hover:bg-white/20 transition-all duration-300 cursor-default group text-center flex flex-col items-center"
                  >
                    <p className="font-adonis text-lg text-white mb-3 text-center">{service.name}</p>
                    <p className="font-georgia-pro text-xs text-white/70 text-center leading-relaxed">{service.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Slide>

      {/* ── Slide 9: What We Want To Raise ──────────────────────────────────── */}
      <Slide id={9} {...slideProps} raw className="bg-white">
        <div className="min-h-screen py-20 px-6 md:px-16">
          <div className="max-w-5xl mx-auto space-y-10">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <h2 className="font-adonis text-4xl md:text-5xl text-black mb-3">What We Want To Raise</h2>
              <p className="font-georgia-pro text-xl text-black">
                Knead is raising <strong className="font-adonis text-2xl">$375,000–$400,000</strong> for a 6-month sprint.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-10 items-start">
              {/* Left: treasury + FF terms + chart */}
              <div className="space-y-6">
                <p className="font-georgia-pro text-base text-gray-700">
                  The Treasury funds community tips and Demeter activations. It&apos;s protected by a multi-sig wallet — one of which is a cold storage physical wallet for signature. Verifiable on Basescan{" "}
                  <a href="https://basescan.org/address/0xe0c1EeBc42553C2a814905E5f73e5Fde2c52D8Fa" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black transition-colors">here</a>.
                </p>

                <div>
                  <p className="font-adonis text-base text-black mb-3">FF Round Terms (Private)</p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {[
                      ["Instrument", "Post-Money SAFE"],
                      ["Valuation Cap", "$1,500,000"],
                      ["Discount", "20%"],
                      ["Minimum Investment", "$1,000"],
                      ["Minimum Raise", "$25,000"],
                      ["Maximum Raise", "$150,000"],
                    ].map(([k, v], i) => (
                      <div key={i} className={`flex justify-between items-center px-4 py-2.5 ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                        <span className="font-adonis text-xs text-gray-500">{k}</span>
                        <span className="font-adonis text-sm text-black">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-adonis text-base text-black mb-2 text-center">6-Month Budget</h3>
                  <DonutChart />
                </div>
              </div>

              {/* Right: investor benefits + community round calculator */}
              <div className="space-y-6">
                <div>
                  <p className="font-adonis text-base text-black mb-3">Investor Benefits</p>
                  <div className="space-y-3">
                    {[
                      {
                        amount: "$1,000+",
                        items: ["All-Access Knead Membership", "Contributor status (20% cashback, DMs, video chat & Demeter)", "Knead Merch + Print Pack", "Name credit in print magazine"],
                      },
                      {
                        amount: "$5,000+",
                        items: ["Everything in $1K tier", "Priority event access", "16 hrs Knead agency project ($1,600 value)", "Special-tiered name credit in print"],
                      },
                      {
                        amount: "$10,000+",
                        items: ["Everything in $5K tier", "VIP dinner treatment", "32 hrs Knead agency project ($3,200 value)", "One special message in a Knead print issue"],
                      },
                    ].map((tier, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="font-adonis text-sm text-black mb-2">{tier.amount}</p>
                        <ul className="space-y-1">
                          {tier.items.map((item, j) => (
                            <li key={j} className="flex items-start gap-2 font-georgia-pro text-xs text-gray-600">
                              <span className="text-black mt-1 flex-shrink-0 text-[10px]">●</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-black rounded-xl p-5 text-white">
                  <p className="font-adonis text-xs text-gray-400 uppercase tracking-widest mb-1">Coming Early July 2026</p>
                  <p className="font-adonis text-base text-white mb-1">Community Round — Open To All</p>
                  <p className="font-georgia-pro text-xs text-gray-300 mb-4">Knead&apos;s public raise on Wefunder (Reg CF) opens alongside our public launch — anyone can invest.</p>
                  <CommunityRoundCalculator />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Slide>

      {/* ── Slide 10: The S-Tier Line ────────────────────────────────────────── */}
      <Slide id={10} {...slideProps} className="bg-white">
        <div className="max-w-5xl grid md:grid-cols-2 gap-12 items-start">
          <div>
            <motion.p variants={fadeIn} className="font-adonis text-xs text-gray-400 uppercase tracking-widest mb-4">Activation 01</motion.p>
            <motion.h2 variants={fadeIn} className="font-adonis text-4xl md:text-5xl text-black mb-8">
              The S-Tier Line
            </motion.h2>
            <motion.div variants={staggerContainer} className="space-y-5 font-georgia-pro text-lg text-gray-700">
              <motion.p variants={fadeIn}>
                The S-Tier line will be NFC-enabled clothing that will be how we distribute semi-annual and annual memberships.
              </motion.p>
              <motion.p variants={fadeIn}>
                The lineup will consist of high-quality embroidered items priced to match our membership — a <strong className="text-black">$25 hat</strong> unlocks a 6-month membership, while a <strong className="text-black">$45 sweatshirt</strong> unlocks 12 months.
              </motion.p>
              <motion.p variants={fadeIn}>
                With initial seeding to Contributors, those individuals will be able to tap and redeem Knead memberships to give — driving word-of-mouth to their influential networks.
              </motion.p>
              <motion.p variants={fadeIn} className="text-sm text-gray-500">
                IYK for NFC chips.
              </motion.p>
            </motion.div>
          </div>
          <motion.div variants={fadeIn} className="flex justify-center items-center">
            <div className="relative w-full rounded-xl overflow-hidden shadow-lg" style={{ height: "480px" }}>
              <Image
                src="/s-tier-clothing.jpg"
                alt="S-Tier clothing line"
                fill
                className="object-cover"
              />
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* ── Slide 11: Knead Print Magazine ──────────────────────────────────── */}
      <Slide id={11} {...slideProps} className="bg-gray-50">
        <div className="max-w-5xl">
          <motion.p variants={fadeIn} className="font-adonis text-xs text-gray-400 uppercase tracking-widest mb-4">Activation 02</motion.p>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <motion.h2 variants={fadeIn} className="font-adonis text-4xl md:text-5xl text-black mb-8">
                Knead Print Magazine
              </motion.h2>
              <motion.div variants={staggerContainer} className="space-y-4 font-georgia-pro text-lg text-gray-700">
                <motion.p variants={fadeIn}>
                  Knead&apos;s print issue will also be NFC-enabled as a membership option.
                </motion.p>
                <motion.p variants={fadeIn}>
                  The magazine will be a heavy-matte, coffee table style publication with rich interviews and original photography.
                </motion.p>
                <motion.p variants={fadeIn}>
                  Each issue will feature an NFC chip enabling a semi-annual Knead membership upon tap to gift for Contributors.
                </motion.p>
              </motion.div>
            </div>
            <motion.div variants={fadeIn} className="flex justify-center">
              <div className="relative w-full overflow-hidden" style={{ height: "520px" }}>
                <Image
                  src="/print-magazine-mockup.png"
                  alt="Knead Print Magazine"
                  fill
                  className="object-cover object-top"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </Slide>

      {/* ── Slide 12: Blvck Svm Dinner ──────────────────────────────────────── */}
      <Slide id={12} {...slideProps} raw className="bg-white">
        <div className="min-h-screen py-20 px-6 md:px-16">
          <div className="max-w-5xl mx-auto">
            <p className="font-adonis text-xs text-gray-400 uppercase tracking-widest mb-4">Activation 03</p>
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <h2 className="font-adonis text-4xl md:text-5xl text-black mb-8">
                  Blvck Svm Dinner in Richmond, VA
                </h2>
                <div className="space-y-4 font-georgia-pro text-lg text-gray-700">
                  <p>
                    Knead will be inviting the musician Blvck Svm to Richmond, Virginia for an exclusive <em>michelinman</em> dinner pairing.
                  </p>
                  <p>
                    Partnering with Michelin-star chefs around the world, Blvck Svm has been offering diners an intimate experience of breaking down each song off his album <em>michelinman</em> — with each course paired to a different track.
                  </p>
                  <div className="space-y-3 pt-2">
                    {[
                      { tier: "$5,000+ investors", desc: "Complimentary ticket to the general public dinner." },
                      { tier: "$10,000+ investors", desc: "VIP treatment — hotel, flight, general public dinner ticket, and seat at a private dinner." },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="text-black mt-1.5 flex-shrink-0 text-xs">●</span>
                        <p><strong className="font-adonis text-black">{item.tier}:</strong> {item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <SwipeableCarousel
                  images={dinnerPartyPhotos}
                  currentIndex={currentDinnerPhoto}
                  setCurrentIndex={setCurrentDinnerPhoto}
                  height="460px"
                />
              </div>
            </div>
          </div>
        </div>
      </Slide>

      {/* ── Slide 13: Timeline ───────────────────────────────────────────────── */}
      <Slide id={13} {...slideProps} raw className="bg-gray-50">
        <div className="min-h-screen py-20 px-6 md:px-16">
          <div className="max-w-4xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              className="font-adonis text-4xl md:text-5xl text-black mb-12"
            >
              Timeline
            </motion.h2>
            <div className="space-y-10">
              <div>
                <h3 className="font-adonis text-xl text-black mb-5 flex items-center gap-2">
                  Phase 1: Build &amp; Iterate
                  <span className="text-sm font-georgia-pro text-gray-400">✓ Complete</span>
                </h3>
                <div className="space-y-2.5">
                  {[
                    "V1 of chat finished",
                    "Early beta testing and community feedback",
                    "V1.2 of chat — security hardening and smart contract overhaul",
                    "Implemented Demeter — our agentic solution — in the chat",
                    "Added social-ready features and new community tools",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 px-4 rounded-lg bg-black/5">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 bg-black">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </div>
                      <p className="font-georgia-pro text-sm text-gray-500 line-through">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-adonis text-xl text-black mb-5 flex items-center gap-2">
                  Phase 2: Launch
                  <span className="text-sm font-georgia-pro text-gray-400">(Months 1–3)</span>
                </h3>
                <div className="space-y-2.5">
                  {[
                    "Public launch and contributor onboarding",
                    "Agency pipeline established — first client projects begin",
                    "S-Tier clothing line and print magazine in production",
                    "Inaugural dinner series confirmed",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 px-4 rounded-lg bg-white border border-gray-100">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 mt-0.5" />
                      <p className="font-georgia-pro text-sm text-gray-700">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-adonis text-xl text-black mb-5 flex items-center gap-2">
                  Phase 3: Scale
                  <span className="text-sm font-georgia-pro text-gray-400">(Months 4–6)</span>
                </h3>
                <div className="space-y-2.5">
                  {[
                    "First agency clients acquired and case studies built",
                    "50+ Contributors established, community self-sustaining",
                    "Membership + Agency model is self-sustaining",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 px-4 rounded-lg bg-white border border-gray-100">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 mt-0.5" />
                      <p className="font-georgia-pro text-sm text-gray-700">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Slide>

      {/* ── Slide 14: Invest in Knead ────────────────────────────────────────── */}
      <Slide id={14} {...slideProps} raw className="bg-white">
        <div className="min-h-screen py-20 px-6 md:px-16">
          <div className="max-w-2xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="text-center mb-10">
              <h2 className="font-adonis text-3xl md:text-5xl text-black mb-4">
                Invest in tomorrow&apos;s publishing tools today
              </h2>
              <p className="font-georgia-pro text-base text-gray-600">
                Fill out the form below to invest in Knead&apos;s FF Round (private). We&apos;ll send your pre-filled SAFE to sign and payment instructions within 24 hours.
              </p>
            </motion.div>
            <SAFEInvestorForm />
          </div>
        </div>
      </Slide>

    </div>
  )
}
