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
import Paywall from "@/components/paywall"

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
          <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentIndex(() => i) }} className={`w-2 h-2 rounded-full transition-all duration-300 ${i === currentIndex ? "bg-white" : "bg-white/40"}`} aria-label={`Go to photo ${i + 1}`} type="button" />
        ))}
      </div>
    </div>
  )
}

// ─── Slide Wrapper ────────────────────────────────────────────────────────────

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

function ConstantPracticeDemo() {
  return (
    <div className="max-w-md border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
      <div className="relative w-full" style={{ height: "200px" }}>
        <Image
          src="/constant-practice-photo.jpg"
          alt="Constant Practice"
          fill
          className="object-cover"
        />
      </div>
      <div className="px-5 pt-4 pb-2">
        <h3 className="font-adonis text-lg text-black mb-1">Constant Practice</h3>
        <p className="font-georgia-pro text-xs text-gray-500 italic mb-3">
          With vintage luxury more sought-after than ever, how does one of the most popular curators separate itself from the pack?
        </p>
        <div className="relative overflow-hidden" style={{ maxHeight: "120px" }}>
          <p className="font-georgia-pro text-sm text-gray-700 leading-relaxed mb-2">
            &ldquo;It&apos;s like looking at art - everyone will have their own opinion and be drawn to something different, so we don&apos;t hope to convey anything in particular, we just like sharing it,&rdquo; — Jonah Franke-Fuller says of Constant Practice.
          </p>
          <p className="font-georgia-pro text-sm text-gray-700 leading-relaxed">
            Constant Practice is a team that specializes in vintage menswear. Led primarily by Zeke and Jonah Franke-Fuller, the duo&apos;s compiled a luxury collection highlighting utility, material, and function, while also showcasing trendy relics that often make for fun show pieces. Its rotation features designers ranging from Issey Miyake, Burberry Prorsum, and Comme des Garçons to Salomon and Samsonite.
          </p>
          <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-white to-transparent" />
        </div>
      </div>
      <div className="px-5 pb-5">
        <Paywall />
      </div>
    </div>
  )
}

// ─── DonutChart ───────────────────────────────────────────────────────────────

function DonutChart() {
  const data = [
    { label: "Team", value: 1895110, color: "#000000", note: "13 hires, incl. 27% overhead" },
    { label: "Treasury", value: 1400000, color: "#374151", note: "On-chain reward pool" },
    { label: "Operations", value: 299000, color: "#6b7280", note: "Incl. $35k equipment & software" },
    { label: "Activations", value: 108000, color: "#9ca3af", note: "S-Tier, Print, Blvck Svm dinner" },
  ]
  const total = 3702110

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
            $3,702,110
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
          <p className="font-georgia-pro text-xs text-gray-400 italic">Recommended raise: $3.5M–$4M</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TOTAL_SLIDES = 16

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
            Ushering in the future of publishing
          </motion.p>
          <motion.p variants={fadeIn} className="font-georgia-pro text-sm text-gray-400 mt-16">Scroll to explore ↓</motion.p>
        </div>
      </Slide>

      {/* ── Slide 1: The Internet + Problem (combined) ───────────────────────── */}
      <Slide id={1} {...slideProps} className="bg-gray-50">
        <div className="max-w-4xl">
          <motion.h1 variants={fadeIn} className="font-adonis text-4xl md:text-6xl lg:text-7xl text-black mb-6 leading-tight">
            The internet is moving back in-house.
          </motion.h1>
          <motion.p variants={fadeIn} className="font-adonis text-2xl md:text-3xl text-black mb-10 italic">
            We&apos;ve lost the art of being premium online.
          </motion.p>
          <motion.div variants={staggerContainer} className="space-y-4 font-georgia-pro text-lg md:text-xl text-gray-700 max-w-3xl">
            {[
              "Stadium-status musicians are using Linktree as their main website.",
              "Best-selling authors are promoting the same blandly-designed Substack for their prose.",
              "Well-respected interviewers are stopping thought-provoking conversations to ask for Patreon donations.",
              "None of this was a part of our childhood dreams. It's time we take ownership and make the internet fun again.",
              "That's why we're excited to show you what we've built…",
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
        <div className="relative z-10 min-h-screen flex items-center justify-center px-6 md:px-16">
          <div className="text-center max-w-3xl">
            <h2 className="font-adonis text-5xl md:text-7xl lg:text-8xl text-black mb-8">
              Knead 2.0
            </h2>
            <p className="font-georgia-pro text-lg md:text-xl text-black max-w-2xl mx-auto mb-6">
              Knead is a media and community platform with paywalled articles, live streaming, video premieres, a gamified chat, &amp; more.
            </p>
            <p className="font-georgia-pro text-base text-gray-600 max-w-2xl mx-auto">
              After attracting over 35,000 readers and 500+ paid subscribers on our last website, we decided to build a home for an even more impactful community from scratch. Here&apos;s how it works:
            </p>
          </div>
        </div>
      </Slide>

      {/* ── Slide 3: The Journey ─────────────────────────────────────────────── */}
      <Slide id={3} {...slideProps} className="bg-white">
        <div className="max-w-5xl grid md:grid-cols-2 gap-12 items-start">
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
                To upgrade, we offer a <strong className="text-black">Knead Monthly</strong> membership at <strong className="text-black">$5/month</strong> — payable via credit card or Google/Apple Pay — which enables unlimited reads + the ability to earn USDC from Contributors in the chat.
              </motion.p>
              <motion.p variants={fadeIn}>
                Both memberships are soulbound NFTs minted on Base, handling payment + subscription hooks via Stripe.
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
        <div className="max-w-5xl grid md:grid-cols-2 gap-12 items-start">
          <div>
            <motion.h2 variants={fadeIn} className="font-adonis text-4xl md:text-5xl text-black mb-8">
              The Chat
            </motion.h2>
            <motion.div variants={staggerContainer} className="space-y-5 font-georgia-pro text-lg text-gray-700">
              <motion.p variants={fadeIn}>
                Knead&apos;s chat is our hub for community, serving as the focal point for connecting with our audience. It&apos;s capable of hosting a wide range of events, using tools like:
              </motion.p>
              <motion.ul variants={fadeIn} className="space-y-3 pl-2">
                <li className="flex items-start gap-3">
                  <span className="text-black mt-1.5 flex-shrink-0 text-xs">●</span>
                  <span><strong className="text-black font-adonis">Live Streaming</strong> includes a guest takeover for hosting and music mode for high-quality audio output. Perfect for interviews, DJ sets, and more.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-black mt-1.5 flex-shrink-0 text-xs">●</span>
                  <span>Uploading movies, music videos, interviews, and other content to premiere in the chat.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-black mt-1.5 flex-shrink-0 text-xs">●</span>
                  <span>Gating the chat exclusively for niche community events, like students or a nonprofit.</span>
                </li>
              </motion.ul>
              <motion.p variants={fadeIn}>
                It&apos;s intentionally designed to be a space we want to spend every day in — hosting an array of events we&apos;d be excited to attend ourselves, while being an enriching experience for our members.
              </motion.p>
            </motion.div>
          </div>

          <motion.div variants={fadeIn} className="flex flex-col gap-3">
            <div className="relative rounded-xl overflow-hidden shadow-lg" style={{ height: "300px" }}>
              <Image
                src="/VideoScreenExample.png"
                alt="Live streaming in the Knead chat"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <a
                  href="/chat"
                  className="bg-white text-black px-6 py-3 rounded font-adonis text-sm hover:bg-gray-100 transition-colors shadow-lg"
                >
                  Click to Demo
                </a>
              </div>
            </div>
            <p className="font-georgia-pro text-sm text-gray-500 text-center italic">
              Want to see what it&apos;s like to be the star of the show?
            </p>
          </motion.div>
        </div>
      </Slide>

      {/* ── Slide 6: The Knead Monthly Member ───────────────────────────────── */}
      <Slide id={6} {...slideProps} className="bg-gray-50">
        <div className="max-w-5xl grid md:grid-cols-2 gap-12 items-start">
          <div>
            <motion.h2 variants={fadeIn} className="font-adonis text-4xl md:text-5xl text-black mb-8">
              The Knead Monthly Member
            </motion.h2>
            <motion.div variants={staggerContainer} className="space-y-5 font-georgia-pro text-lg text-gray-700">
              <motion.p variants={fadeIn}>
                When a Knead Monthly member joins the chat, they&apos;ll be able to leave comments during events like livestreams, premieres, open hours, etc.
              </motion.p>
              <motion.p variants={fadeIn}>
                Knead Monthly members can earn USDC for comments from Contributors, which is kept track of in Knead&apos;s Treasury. With enough earnings, members can graduate to become a Contributor — which enables full functionality of the chat.
              </motion.p>
            </motion.div>
          </div>

          <motion.div variants={fadeIn} className="flex flex-col">
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
          <div>
            <motion.h2 variants={fadeIn} className="font-adonis text-4xl md:text-5xl text-black mb-8">
              Contributors
            </motion.h2>
            <motion.div variants={staggerContainer} className="space-y-5 font-georgia-pro text-lg text-gray-700">
              <motion.p variants={fadeIn}>
                Contributors are VIPs we invite (magazine subjects, influencers, etc.) or Knead Monthly members who have graduated.
              </motion.p>
              <motion.p variants={fadeIn}>
                Each week, Contributors are allocated an allowance of USDC to spend on Knead Monthly members, earning <strong className="text-black">20% back</strong> of what they spend. The allowance is on a &lsquo;use it or lose it&rsquo; basis.
              </motion.p>
              <motion.p variants={fadeIn}>
                In addition to posting freely, Contributors are granted access to DMs — including video chat. Contributors can search the DM rolodex for others they want to connect with, or turn off being contacted altogether.
              </motion.p>
              <motion.p variants={fadeIn}>
                Being a Contributor is a title you have to earn your way into IRL or in the chat — it&apos;s not something that can be bought into.
              </motion.p>
            </motion.div>
          </div>

          <motion.div variants={fadeIn}>
            <p className="font-adonis text-xs text-gray-400 uppercase tracking-widest mb-3">Contributor View</p>
            <WalletSummaryDemo state="contributor" />
          </motion.div>
        </div>
      </Slide>

      {/* ── Slide 8: How Does This Help Others ──────────────────────────────── */}
      <Slide id={8} {...slideProps} raw className="bg-gray-50">
        <div className="min-h-screen py-20 px-6 md:px-16">
          <div className="max-w-5xl mx-auto space-y-16">
            <motion.h2
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              className="font-adonis text-4xl md:text-5xl text-black"
            >
              How does this framework help other businesses?
            </motion.h2>

            <div>
              <h3 className="font-adonis text-2xl md:text-3xl text-black mb-6">Knead As A Publisher &amp; Community</h3>
              <p className="font-georgia-pro text-lg text-gray-700 mb-8">
                Our framework enables us to create curated digital events with real-world value for our partners. Some examples:
              </p>
              <div className="space-y-6">
                {[
                  {
                    title: "Recruiting",
                    body: "A well-known fashion designer based out of Milan is looking for new hires and wants to get in front of American students from FIT and Parsons. Knead sets up a time for those students to exclusively ask the designer questions in the chat — creating opportunities for upcoming graduates to gain visibility with Contributors and other viewers.",
                  },
                  {
                    title: "Product Seeding & Feedback",
                    body: "With a strong rolodex of Contributors, Knead enables companies to gain early feedback and interest on products. This can include direct metrics on who redeemed what items and why — valuable in early seeding and messaging.",
                  },
                  {
                    title: "Sponsorship",
                    body: "By enabling video upload and streaming, we've expanded our ability to accept ongoing or temporal sponsorship without compromising print editorial standards. We've created significant new pathways to deliver bespoke opportunities for sponsors to engage with our brand.",
                  },
                ].map((item, i) => (
                  <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h4 className="font-adonis text-lg text-black mb-2">{item.title}</h4>
                    <p className="font-georgia-pro text-base text-gray-700">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-adonis text-2xl md:text-3xl text-black mb-6">Knead As A Solution</h3>
              <p className="font-georgia-pro text-lg text-gray-700 mb-6">
                We believe everything we offer with Knead can be used by other creators and brands alike. By offering bespoke solutions as a development agency, we can apply our framework to an array of prospective customers. A few examples:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  "A musician who wants to set up a temporary space for an album release stream, enabling the artist to tip the best comments.",
                  "A consulting group that wants a password-protected encrypted chat to securely stream and chat with clients.",
                  "Agencies that represent independent content creators.",
                  "Brands that want to self-host their own media platforms for campaigns.",
                  "Independent writers, podcasts, and other media who want their own platform.",
                ].map((item, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-3">
                    <span className="text-black font-adonis mt-0.5 flex-shrink-0">—</span>
                    <p className="font-georgia-pro text-sm text-gray-700">{item}</p>
                  </div>
                ))}
              </div>
              <p className="font-georgia-pro text-lg text-gray-700 mt-8 font-italic">
                If every company is a media company, there&apos;s no end of prospective clients we can design solutions for.
              </p>
            </div>
          </div>
        </div>
      </Slide>

      {/* ── Slide 9: What We Want To Raise + Budget ──────────────────────────── */}
      <Slide id={9} {...slideProps} raw className="bg-white">
        <div className="min-h-screen py-20 px-6 md:px-16">
          <div className="max-w-5xl mx-auto space-y-16">

            <motion.h2
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              className="font-adonis text-4xl md:text-5xl text-black"
            >
              What We Want To Raise
            </motion.h2>

            <div className="max-w-3xl space-y-5 font-georgia-pro text-lg text-gray-700">
              <p>Knead is seeking <strong className="text-black font-adonis">$3.7 million</strong> through grants, partnerships, sponsorship, and customer acquisition — for one year of runway.</p>
              <p>Why dedicate so much of the budget to the Treasury?</p>
              <ul className="list-disc pl-6 space-y-3">
                <li>Provides a powerful marketing tool to onboard Contributors from our Highsnobiety/fashion/media/art communities — graduating from our immediate network to A-list celebrities.</li>
                <li>
                  With a working framework in place, showing real-world value quickly creates strong word-of-mouth:
                  <ul className="mt-2 ml-4 space-y-1 list-none">
                    <li className="italic text-black">&ldquo;I earned over $100 this month in the Knead chat. It paid for my phone bill.&rdquo;</li>
                    <li className="italic text-black">&ldquo;I make passive income in this group chat that&apos;s around $20/week.&rdquo;</li>
                  </ul>
                </li>
                <li>The chat&apos;s cashback mechanism encourages stable activity rather than the speculative behavior that&apos;s plagued DAOs — no dumping after airdrops.</li>
                <li>Traditional giveaways have a conservative conversion rate of 18–25%. With Knead&apos;s chat, every member has the opportunity to earn right away.</li>
                <li>At a rate of 18% conversion + resupplying the Treasury with 20% of Knead Monthly&apos;s $5/month revenue, our chat would be self-sustaining of its $1.04M pool at a goal of 25,000 paid members.</li>
                <li>The Treasury is protected by a multi-sig wallet, one of which is a cold storage physical wallet for signature.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-adonis text-3xl text-black mb-8">Prospective Annual Budget</h3>
              <DonutChart />
            </div>

            <div>
              <h3 className="font-adonis text-2xl text-black mb-6">Budget Breakdown</h3>

              <div className="mb-8">
                <h4 className="font-adonis text-lg text-black mb-3 border-b border-gray-200 pb-2">Team Salaries (27% overhead applied)</h4>
                <div className="space-y-1.5">
                  {[
                    ["EIC / Founder", "$130,000", "$165,100"],
                    ["CTO", "$165,000", "$209,550"],
                    ["COO / VP Production", "$165,000", "$209,550"],
                    ["Creative Director", "$125,000", "$158,750"],
                    ["Head of Community", "$102,000", "$129,540"],
                    ["Senior Producer", "$93,000", "$118,110"],
                    ["Full Stack Developer ×2", "$280,000", "$355,600"],
                    ["Art Director", "$103,000", "$130,810"],
                    ["Copy Editor", "$92,000", "$116,840"],
                    ["Creatives ×2", "$166,000", "$210,820"],
                    ["Events Coordinator", "$72,000", "$91,440"],
                  ].map(([role, base, total], i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-50">
                      <span className="font-georgia-pro text-sm text-gray-700">{role}</span>
                      <div className="flex gap-6 text-right">
                        <span className="font-georgia-pro text-sm text-gray-500 w-24">{base}</span>
                        <span className="font-adonis text-sm text-black w-24">{total}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-2 mt-1 border-t border-gray-300">
                    <span className="font-adonis text-sm text-black">Subtotal — 13 People</span>
                    <div className="flex gap-6 text-right">
                      <span className="font-georgia-pro text-sm text-gray-500 w-24">$1,493,000</span>
                      <span className="font-adonis text-sm text-black w-24">$1,895,110</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h4 className="font-adonis text-lg text-black mb-3 border-b border-gray-200 pb-2">Operational Budget</h4>
                <div className="space-y-1.5">
                  {[
                    ["Freelance — editorial + photography (~25 stories)", "$65,000"],
                    ["Legal / accounting (Web3 counsel + CPA)", "$50,000"],
                    ["Office / coworking — Richmond, VA (remote-first)", "$24,000"],
                    ["Travel + activations (editorial + IRL events)", "$100,000"],
                    ["Infrastructure — full stack at growth stage", "$25,000"],
                    ["Equipment — laptops, software, office items", "$35,000"],
                  ].map(([label, val], i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-50">
                      <span className="font-georgia-pro text-sm text-gray-700">{label}</span>
                      <span className="font-adonis text-sm text-black">{val}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-2 mt-1 border-t border-gray-300">
                    <span className="font-adonis text-sm text-black">Subtotal — Operations</span>
                    <span className="font-adonis text-sm text-black">$299,000</span>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h4 className="font-adonis text-lg text-black mb-3 border-b border-gray-200 pb-2">Knead Treasury — On-Chain Reward Pool</h4>
                <div className="space-y-1.5">
                  {[
                    ["Contributor weekly allowance (200 × $100/wk × 52)", "$1,040,000"],
                    ["20% cashback float + reserve + Member pool", "$360,000"],
                  ].map(([label, val], i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-50">
                      <span className="font-georgia-pro text-sm text-gray-700">{label}</span>
                      <span className="font-adonis text-sm text-black">{val}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-2 mt-1 border-t border-gray-300">
                    <span className="font-adonis text-sm text-black">Total Treasury Ask</span>
                    <span className="font-adonis text-sm text-black">$1,400,000</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center py-3 bg-black text-white rounded-lg px-4">
                <span className="font-adonis text-base">Total Raise — Year 1</span>
                <span className="font-adonis text-base">$3,702,110</span>
              </div>
              <p className="font-georgia-pro text-xs text-gray-400 mt-3 italic">
                27% overhead applied to all salaries: FICA (7.65%), FUTA/SUTA (~1%), employer health (~12%), misc (~6%). Treasury funds flow on-chain via smart contract — Knead never holds them. Infrastructure reflects growth-stage usage across Vercel, Supabase, Mux, Sanity, Daily, Resend, ThirdWeb, and Alchemy.
              </p>
            </div>

          </div>
        </div>
      </Slide>

      {/* ── Slide 10: The S-Tier Line ────────────────────────────────────────── */}
      <Slide id={10} {...slideProps} className="bg-white">
        <div className="max-w-5xl">
          <motion.p variants={fadeIn} className="font-adonis text-xs text-gray-400 uppercase tracking-widest mb-4">Activation 01</motion.p>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <motion.h2 variants={fadeIn} className="font-adonis text-4xl md:text-5xl text-black mb-8">
                The S-Tier Line
              </motion.h2>
              <motion.div variants={staggerContainer} className="space-y-4 font-georgia-pro text-lg text-gray-700">
                <motion.p variants={fadeIn}>
                  The S-Tier line will be NFC-enabled clothing that will be how we distribute semi-annual and annual memberships.
                </motion.p>
                <motion.p variants={fadeIn}>
                  The lineup will consist of high-quality embroidered items priced to match our membership — a $25 hat unlocks a 6-month membership, while a $40 sweatshirt unlocks 12 months.
                </motion.p>
                <motion.p variants={fadeIn}>
                  The goal is for the clothing&apos;s (S) tag to be a talking point IRL: <em>&ldquo;What&apos;s that S? You don&apos;t wear a small.&rdquo;</em>
                </motion.p>
                <motion.p variants={fadeIn}>
                  With initial seeding to Contributors, those individuals will be able to tap and redeem Knead memberships to gift — driving word-of-mouth to their influential networks.
                </motion.p>
                <motion.p variants={fadeIn} className="text-black">
                  IYK for NFC chips.<br />
                  <strong>Estimated cost: $50–60k</strong>
                </motion.p>
              </motion.div>
            </div>
            <motion.div variants={fadeIn} className="flex justify-center">
              <div className="relative w-full rounded-xl overflow-hidden shadow-2xl" style={{ height: "480px" }}>
                <Image
                  src="/mock-up.png"
                  alt="S-Tier line with NFC-enabled clothing"
                  fill
                  className="object-cover"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </Slide>

      {/* ── Slide 11: Knead Print Magazine ──────────────────────────────────── */}
      <Slide id={11} {...slideProps} raw className="bg-gray-50">
        <div className="min-h-screen py-20 px-6 md:px-16">
          <div className="max-w-5xl mx-auto">
            <p className="font-adonis text-xs text-gray-400 uppercase tracking-widest mb-4">Activation 02</p>
            <div className="mb-10">
              <h2 className="font-adonis text-4xl md:text-5xl text-black mb-8">
                Knead Print Magazine
              </h2>
              <div className="space-y-4 font-georgia-pro text-lg text-gray-700 max-w-2xl">
                <p>
                  Knead&apos;s print issue will also be NFC-enabled as a membership option. TBD printing schedule, the magazine will be a heavy-matte, coffee table style publication with rich interviews of the world&apos;s leading creative minds.
                </p>
                <p>
                  Each issue will feature an NFC chip enabling a semi-annual Knead membership upon tap — another access point to onboard into the chat.
                </p>
                <p className="text-black">
                  <strong>Estimated cost: $18,000 for 300+ copies</strong>
                </p>
              </div>
            </div>
            <div className="relative w-full rounded-xl overflow-hidden shadow-2xl bg-white" style={{ height: "70vh" }}>
              <Image
                src="/print-magazine-mockup.png"
                alt="Knead Print Magazine"
                fill
                className="object-contain"
              />
            </div>
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
                    Knead will be inviting the rapper Blvck Svm to the Branch Museum in Richmond for an exclusive <em>michelinman</em> dinner pairing.
                  </p>
                  <p>
                    Partnering with Michelin-star chefs around the world, Blvck Svm has been offering diners an intimate experience of breaking down each song off his album <em>michelinman</em> — with the chef defining a dish to accompany.
                  </p>
                  <p>
                    For one of our giveaways, we&apos;d like to fly five Contributors from the chat in for an all expenses paid experience — highlighting an exclusive event only for superfans/VIPs. Other Contributors will be able to nominate and vote on who should be treated to the experience.
                  </p>
                  <p className="text-black">
                    <strong>Estimated cost: $40,000, including giveaway</strong>
                  </p>
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
                  Phase 1: Hardening
                  <span className="text-sm font-georgia-pro text-gray-400">(Months 1–2)</span>
                </h3>
                <div className="space-y-2.5">
                  {[
                    { text: "V1 of chat finished", done: true },
                    { text: "Early Beta testing and feedback", done: true },
                    { text: "V1.2 of chat finished", done: true },
                    { text: "Begin inviting influencer network of Contributors", done: false },
                    { text: "Grant applications", done: false },
                    { text: "Smart contract audit / load testing / security review", done: false },
                    { text: "Private beta stays small", done: false },
                  ].map((item, i) => (
                    <div key={i} className={`flex items-start gap-3 py-2 px-4 rounded-lg ${item.done ? "bg-black/5" : "bg-white border border-gray-100"}`}>
                      <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${item.done ? "bg-black" : "border-2 border-gray-300"}`}>
                        {item.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                      <p className={`font-georgia-pro text-sm ${item.done ? "text-gray-500 line-through" : "text-gray-700"}`}>
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-adonis text-xl text-black mb-5 flex items-center gap-2">
                  Phase 2: Early Growth
                  <span className="text-sm font-georgia-pro text-gray-400">(Months 3–6)</span>
                </h3>
                <div className="space-y-2.5">
                  {[
                    "Public launch",
                    "Agency pipeline established",
                    "Chat events weekly",
                    "Print issue in line",
                    "Merch announced and ready",
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
                  <span className="text-sm font-georgia-pro text-gray-400">(Months 6–12)</span>
                </h3>
                <div className="space-y-2.5">
                  {[
                    "First agency clients acquired",
                    "200–300 Contributors established",
                    "25,000 Knead Monthly members",
                    "Self-sustaining model for both Knead as a publisher and agency",
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

      {/* ── Slide 14: The Big Deal ───────────────────────────────────────────── */}
      <Slide id={14} {...slideProps} className="bg-white">
        <div className="max-w-4xl space-y-8">
          <motion.h2 variants={fadeIn} className="font-adonis text-5xl md:text-7xl text-black">
            The Big Deal
          </motion.h2>
          {[
            "Knead's foundation could be the bridge between bringing the majority — and late-majority — into Web3.",
            "It's not enough to explain to them what the future of media looks like. We have to start showing people.",
            "That conversation begins with ownership, showcasing that we no longer have to be reliant on apps and platforms. Instead, we can build things specifically for what our audiences want.",
            "The future of the internet is going to be fun again — which is exactly what we want to lead the charge in showing.",
          ].map((para, i) => (
            <motion.p key={i} variants={fadeIn} className="font-georgia-pro text-xl md:text-2xl text-black leading-relaxed">
              {para}
            </motion.p>
          ))}
        </div>
      </Slide>

      {/* ── Slide 15: See For Yourself ───────────────────────────────────────── */}
      <Slide id={15} {...slideProps} className="bg-black text-white">
        <div className="text-center">
          <motion.h2 variants={fadeIn} className="font-adonis text-5xl md:text-7xl text-white mb-8">
            Want to see for yourself?
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
