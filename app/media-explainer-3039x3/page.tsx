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
            &ldquo;It&apos;s like looking at art - everyone will have their own opinion and be drawn to something different, so we don&apos;t hope to convey anything in particular, we just like sharin[...]
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

// ─── Main Page ───────────────────────────────────────────────────────────

const TOTAL_SLIDES = 10

export default function MediaExplainerPage() {
  const account = useActiveAccount()
  const [currentSlide, setCurrentSlide] = useState(0)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])

  const scrollToSlide = (index: number, e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    setCurrentSlide(index)
    slideRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const slideProps = { slideRefs, setCurrentSlide }

  return (
    <div className="bg-white text-black overflow-x-hidden">

      {/* ── Navigation Dots ─────────────��───────────────────────────────────── */}
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
            Ushering in the future of publishing
          </motion.p>
          <motion.p variants={fadeIn} className="font-georgia-pro text-sm text-gray-400 mt-16">Scroll to explore ↓</motion.p>
        </div>
      </Slide>

      {/* ── Slide 1: The Internet + Problem (combined) ───────────────────────── */}
      <Slide id={1} {...slideProps} className="bg-gray-50">
        <div className="max-w-4xl">
          <motion.h1 variants={fadeIn} className="font-adonis text-4xl md:text-6xl lg:text-7xl text-black mb-10 leading-tight">
            We&apos;ve lost the art of being premium online.
          </motion.h1>
          <motion.div variants={staggerContainer} className="space-y-8 font-georgia-pro text-lg md:text-xl text-gray-700 max-w-3xl">
            {[
              "Stadium-status musicians are using Linktree as their main website.",
              "Best-selling authors are promoting the same blandly-designed Substack for their prose.",
              "Well-respected interviewers are stopping thought-provoking conversations to ask for Patreon donations.",
              "None of this was a part of our childhood dreams.", 
              "It's time we take ownership of making the internet fun again.",
              "That's why we're excited to get started with…",
            ].map((line, i) => (
              <motion.p key={i} variants={fadeIn}>{line}</motion.p>
            ))}
          </motion.div>
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
          <p className="font-georgia-pro text-base text-gray-600 max-w-2xl mx-auto text-center pb-4">
            After attracting over 35,000 readers and 500+ paid subscribers, we decided to build a new home for an even more impactful community.
          </p>
        </div>
      </Slide>

      {/* ── Slide 3: The Journey ─────────────────────────────────────────────── */}
      <Slide id={3} {...slideProps} className="bg-white">
        <div className="max-w-5xl grid md:grid-cols-2 gap-12 items-center">
          <div>
            <motion.h2 variants={fadeIn} className="font-adonis text-4xl md:text-5xl text-black mb-8">
              The Journey
            </motion.h2>
            <motion.div variants={staggerContainer} className="space-y-5 font-georgia-pro text-lg text-gray-700">
              <motion.p variants={fadeIn}>
                Users can sign in with socials or their wallet
              </motion.p>
              <motion.div variants={fadeIn} className="my-2">
                {account ? <WalletSummary /> : <ThirdWebConnectButton />}
              </motion.div>
              <motion.p variants={fadeIn}>
                To upgrade, we offer <strong className="text-black">Knead Monthly at $5/month</strong>, which enables unlimited reads/views + the ability to earn USDC from Contributors in the chat.
              </motion.p>
              <motion.p variants={fadeIn}>
                Both memberships are soulbound NFTs minted on Base, handling payments via Stripe.
              </motion.p>
            </motion.div>
          </div>

          <motion.div variants={fadeIn} className="mt-0">
            <p className="font-adonis text-xs text-gray-400 uppercase tracking-widest mb-3">When the limit is reached</p>
            <ConstantPracticeDemo />
          </motion.div>
        </div>
      </Slide>

      {/* ── Slide 4: Our Stories ─────────────────────────────────────────────── */}
      <Slide id={4} {...slideProps} raw className="bg-gray-900">
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

      {/* ── Slide 5: The Chat ────────────────────────────────────────────────── */}
      <Slide id={5} {...slideProps} className="bg-white">
        <div className="max-w-5xl grid md:grid-cols-2 gap-12 items-center">
          <div>
            <motion.h2 variants={fadeIn} className="font-adonis text-4xl md:text-5xl text-black mb-8">
              The Chat
            </motion.h2>
            <motion.div variants={staggerContainer} className="space-y-5 font-georgia-pro text-lg text-gray-700">
              <motion.p variants={fadeIn}>
                Knead&apos;s chat is our hub for community, serving as the focal point for connecting with our audience. Built on Towns Protocol, it&apos;s capable of hosting a wide range of events.
              </motion.p>
              <motion.ul variants={fadeIn} className="space-y-3 pl-2">
                <li className="flex items-start gap-3">
                  <span className="text-black mt-1.5 flex-shrink-0 text-xs">●</span>
                  <span><strong className="text-black font-adonis">Livestreams:</strong> Includes guest takeovers + music mode (for high-quality audio). Perfect for interviews, DJ sets, and more.</span>
                </li>
                <li className="flex items-start gap-3">
                 <span className="text-black mt-1.5 flex-shrink-0 text-xs">●</span>
                 <span><strong className="text-black font-adonis">Hosting:</strong> Movies, music videos, interviews, and other content to premiere.</span>
                </li>
                <li className="flex items-start gap-3">
                 <span className="text-black mt-1.5 flex-shrink-0 text-xs">●</span>
                 <span><strong className="text-black font-adonis">Private Events:</strong> Gate the chat exclusively for niche community events, like students or nonprofits.</span>
                </li>
               </motion.ul>
              <motion.p variants={fadeIn}>
                It&apos;s intentionally designed to be a space we want to spend every day in — hosting an array of events we&apos;d be excited to attend ourselves, while being an enriching experience for our community.
              </motion.p>
            </motion.div>
          </div>

          <motion.div variants={fadeIn} className="flex justify-center">
            <div className="relative w-full rounded-xl overflow-hidden shadow-lg" style={{ height: "500px" }}>
              <Image
                src="/chat-interface-example.png"
                alt="Knead chat interface"
                fill
                className="object-cover"
                style={{ objectPosition: "center 12%" }}
              />
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* ── Slide 6: The Knead Monthly Member ───────────────────────────────── */}
      <Slide id={6} {...slideProps} className="bg-gray-50">
        <div className="max-w-5xl grid md:grid-cols-2 gap-12 items-start">
          <div className="pt-8 md:pt-16">
            <motion.h2 variants={fadeIn} className="font-adonis text-4xl md:text-5xl text-black mb-8">
              The Knead Monthly Member
            </motion.h2>
            <motion.div variants={staggerContainer} className="space-y-5 font-georgia-pro text-lg text-gray-700">
              <motion.p variants={fadeIn}>
                When a Knead Monthly member joins the chat, they&apos;ll be able to leave comments during events like livestreams, premieres, open hours, etc.
              </motion.p>
              <motion.p variants={fadeIn}>
                Knead Monthly members can earn USDC for comments from Contributors, which is kept track of in Knead&apos;s Treasury. With enough earnings, members can graduate to become a Contributor themselves.
              </motion.p>
            </motion.div>
          </div>

          <motion.div variants={fadeIn} className="flex flex-col items-center pl-4 md:pl-8">
            <p className="font-adonis text-xs text-gray-400 uppercase tracking-widest mb-3">Knead Monthly Member View</p>
            <WalletSummaryDemo state="monthly" />
            <div className="mt-5 max-w-sm">
              <div className="relative w-full rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white" style={{ height: "220px" }}>
                <Image
                  src="/Engagement Example.png"
                  alt="Chat engagement example"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* ── Slide 7: Contributors ────────────────────────────────────────────── */}
      <Slide id={7} {...slideProps} className="bg-white">
        <div className="max-w-5xl grid md:grid-cols-2 gap-12 items-start">
          <div className="pt-8 md:pt-16">
            <motion.h2 variants={fadeIn} className="font-adonis text-4xl md:text-5xl text-black mb-8">
              Contributors
            </motion.h2>
            <motion.div variants={staggerContainer} className="space-y-5 font-georgia-pro text-lg text-gray-700">
              <motion.p variants={fadeIn}>
                Contributors are VIPs we invite (magazine subjects, influencers, etc.) or Knead Monthly members who have graduated.
              </motion.p>
              <motion.p variants={fadeIn}>
                Each week, Contributors are allocated an allowance of USDC to spend on Knead Monthly members, earning <strong className="text-black">20% back</strong> of what they spend. The allowance resets weekly.
              </motion.p>
              <motion.p variants={fadeIn}>
                In addition to posting freely, Contributors are granted access to DMs — including video chat. Contributors can search the DM rolodex for others they want to connect with, or turn off discovery if they prefer.
              </motion.p>
              <motion.p variants={fadeIn}>
                Being a Contributor is a title you have to earn your way into IRL or in the chat — <strong>it&apos;s not something that can be bought into.</strong>
              </motion.p>
            </motion.div>
          </div>

          <motion.div variants={fadeIn} className="flex flex-col items-center pl-4 md:pl-8 pt-20 md:pt-32">
            <p className="font-adonis text-xs text-gray-400 uppercase tracking-widest mb-3">Contributor View</p>
            <WalletSummaryDemo state="contributor" />
          </motion.div>
        </div>
      </Slide>

      {/* ── Slide : Closing ──────────────────────────────────────────────── */}
      <Slide id={9} {...slideProps} className="bg-black text-white">
        <div className="text-center">
          <motion.h2 variants={fadeIn} className="font-adonis text-5xl md:text-7xl text-white mb-8">
            Want to see how it works?
          </motion.h2>
          <motion.div variants={staggerContainer} className="space-y-3">
            <motion.p variants={fadeIn}>
              <a
                href="https://www.kneadmag.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-georgia-pro text-lg md:text-xl text-gray-300 hover:text-white transition-colors underline underline-offset-4"
              >
                kneadmag.com
              </a>
            </motion.p>
            <motion.p variants={fadeIn}>
              <a
                href="https://www.kneadmag.com/chat"
                target="_blank"
                rel="noopener noreferrer"
                className="font-georgia-pro text-lg md:text-xl text-gray-300 hover:text-white transition-colors underline underline-offset-4"
              >
                kneadmag.com/chat
              </a>
            </motion.p>
          </motion.div>
        </div>
      </Slide>

    </div>
  )
}
