"use client"

import React, { useState, useEffect, useRef, type TouchEvent } from "react"
import Image from "next/image"
import { motion, type Variants } from "framer-motion"

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: "easeOut" },
  },
}

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
}

// ─── Swipeable Carousel (reused pattern from blvck-svm page) ─────────────────

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
            style={{
              opacity: currentIndex === i ? 1 : 0,
              zIndex: currentIndex === i ? 1 : 0,
              pointerEvents: currentIndex === i ? "auto" : "none",
            }}
          >
            <Image
              src={img || "/placeholder.svg"}
              alt={`Photo ${i + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        ))}
      </div>
      <button
        onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors z-10"
        aria-label="Previous"
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors z-10"
        aria-label="Next"
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M9 18L15 12L9 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(() => i) }}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${i === currentIndex ? "bg-white" : "bg-white/40"}`}
            aria-label={`Go to photo ${i + 1}`}
            type="button"
          />
        ))}
      </div>
    </div>
  )
}

// ─── Slide Wrapper ────────────────────────────────────────────────────────────

const Slide = ({
  id,
  children,
  slideRefs,
  setCurrentSlide,
  className = "",
}: {
  id: number
  children: React.ReactNode
  slideRefs: React.MutableRefObject<(HTMLDivElement | null)[]>
  setCurrentSlide: (id: number) => void
  className?: string
}) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = slideRefs.current[id]
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setCurrentSlide(id)
            setIsVisible(true)
          }
        })
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.unobserve(el)
  }, [id, slideRefs, setCurrentSlide])

  return (
    <div
      ref={(el) => { slideRefs.current[id] = el }}
      className={`min-h-screen flex items-center justify-center py-20 px-6 md:px-16 ${className}`}
    >
      <motion.div
        initial="hidden"
        animate={isVisible ? "visible" : "hidden"}
        variants={staggerContainer}
        className="w-full max-w-5xl"
      >
        {children}
      </motion.div>
    </div>
  )
}

// ─── Chat Mock UI for Screens 4-6 ────────────────────────────────────────────

const ChatMockMenu = ({ visible }: { visible: boolean }) => (
  <motion.div
    initial={{ x: -280, opacity: 0 }}
    animate={{ x: visible ? 0 : -280, opacity: visible ? 1 : 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    className="absolute left-0 top-0 bottom-0 w-64 bg-black border-r border-white/20 z-20 flex flex-col p-6 shadow-2xl"
  >
    <div className="mb-8">
      <p className="font-adonis text-white text-xl tracking-wider">Knead /chat</p>
      <p className="text-white/60 text-xs mt-1 font-georgia-pro">Powered by Towns Protocol</p>
    </div>
    <nav className="space-y-1">
      {["# general", "# announcements", "# events", "# contributors", "# vip-lounge"].map((ch) => (
        <div key={ch} className="px-3 py-2 rounded-lg hover:bg-white/10 text-white/80 text-sm font-georgia-pro cursor-pointer">
          {ch}
        </div>
      ))}
    </nav>
    <div className="mt-auto space-y-2">
      <div className="px-3 py-2 rounded-lg bg-white/5 text-white/60 text-xs font-georgia-pro">
        🏛 Treasury: 12,400 $TOWNS
      </div>
      <div className="px-3 py-2 rounded-lg hover:bg-white/10 text-white/80 text-sm font-georgia-pro cursor-pointer">
        ⚙ Settings
      </div>
    </div>
  </motion.div>
)

const WalletMock = ({
  mode,
  visible,
}: {
  mode: "participant" | "contributor"
  visible: boolean
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 20 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="bg-black border border-white/20 rounded-2xl p-5 shadow-2xl w-72"
  >
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-adonis">
        {mode === "contributor" ? "C" : "P"}
      </div>
      <div>
        <p className="text-white font-adonis text-sm">
          {mode === "contributor" ? "Contributor" : "Knead Monthly"}
        </p>
        <p className="text-white/50 text-xs font-georgia-pro">0x3f…a9c2</p>
      </div>
      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-georgia-pro ${mode === "contributor" ? "bg-white text-black" : "bg-white/10 text-white/70"}`}>
        {mode === "contributor" ? "VIP" : "Member"}
      </span>
    </div>
    <div className="border-t border-white/10 pt-4 space-y-3">
      {mode === "participant" ? (
        <>
          <div className="flex justify-between text-sm">
            <span className="text-white/60 font-georgia-pro">Total Earned</span>
            <span className="text-white font-adonis">1,240 $TOWNS</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/60 font-georgia-pro">To Graduate</span>
            <span className="text-white font-adonis">3,334 $TOWNS</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
            <div className="bg-white h-1.5 rounded-full" style={{ width: "37%" }} />
          </div>
          <p className="text-white/40 text-xs font-georgia-pro text-center">37% to Contributor</p>
        </>
      ) : (
        <>
          <div className="flex justify-between text-sm">
            <span className="text-white/60 font-georgia-pro">Weekly Allowance</span>
            <span className="text-white font-adonis">25 $TOWNS</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/60 font-georgia-pro">Cashback Rate</span>
            <span className="text-white font-adonis">20%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/60 font-georgia-pro">Claimable</span>
            <span className="text-white font-adonis">18.4 $TOWNS</span>
          </div>
          <button className="w-full mt-2 py-2 bg-white text-black rounded-lg text-sm font-adonis hover:bg-white/90 transition-colors">
            Claim Rewards
          </button>
        </>
      )}
    </div>
  </motion.div>
)

const ChatBackground = () => (
  <div className="absolute inset-0 bg-black overflow-hidden">
    {/* Simulated chat messages */}
    <div className="absolute inset-0 opacity-30 flex flex-col justify-end p-6 gap-2">
      {[
        { user: "alex.eth", msg: "Just got my first $TOWNS reward 🔥", time: "2:14 PM" },
        { user: "contributor.knead", msg: "Welcome! The chat's been incredible lately", time: "2:15 PM" },
        { user: "marina_v", msg: "Watching the interview now – so good", time: "2:16 PM" },
        { user: "jcool.base", msg: "Who else is watching the AMA?", time: "2:17 PM" },
        { user: "knead.admin", msg: "🎉 Event starts in 10 minutes", time: "2:18 PM" },
      ].map((m, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="w-7 h-7 rounded-full bg-white/20 flex-shrink-0" />
          <div>
            <span className="text-white/60 text-xs font-adonis mr-2">{m.user}</span>
            <span className="text-white/40 text-xs font-georgia-pro">{m.time}</span>
            <p className="text-white/70 text-sm font-georgia-pro">{m.msg}</p>
          </div>
        </div>
      ))}
    </div>
    <div className="absolute inset-0 bg-black/60" />
  </div>
)

// ─── Main Page ────────────────────────────────────────────────────────────────

const TOTAL_SLIDES = 10

export default function TownsPitchPage() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])

  // Screen 8 – dinner carousel
  const dinnerPartyPhotos = Array.from({ length: 7 }).map((_, i) => `/dinner-party-${i + 1}.jpg`)
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
      {/* Navigation dots */}
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

      {/* ── Screen 1: Hero ─────────────────────────────────────────────────── */}
      <Slide id={0} {...slideProps} className="bg-white">
        <div className="flex flex-col items-center justify-center text-center space-y-8">
          <motion.h1 variants={fadeIn} className="text-5xl md:text-7xl lg:text-8xl font-adonis tracking-tight text-black">
            Knead x Towns
          </motion.h1>
          <motion.p variants={fadeIn} className="text-xl md:text-2xl font-georgia-pro text-gray-600 max-w-xl">
            Ushering in /chat as the future of media.
          </motion.p>
          <motion.p variants={fadeIn} className="text-sm text-gray-400 font-georgia-pro mt-16">
            Scroll to explore ↓
          </motion.p>
        </div>
      </Slide>

      {/* ── Screen 2: Vision ───────────────────────────────────────────────── */}
      <Slide id={1} {...slideProps}>
        <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis mb-12 text-center">
          Every company will have a /chat.
        </motion.h2>
        <motion.div variants={staggerContainer} className="max-w-3xl mx-auto space-y-5 font-georgia-pro text-lg md:text-xl text-gray-700">
          {[
            "The internet is moving in-house.",
            "Shifting from platforms to protocols.",
            "Brands building communities natively on their own websites.",
            "Custom frameworks for fans — live video, gamified rewards, and more.",
            "The most engaging spaces are shifting off social media.",
            '"Every company is a media company" — owning distribution is the competitive edge.',
            "Knead's /chat is the infrastructure for brands who get it.",
          ].map((line, i) => (
            <motion.p key={i} variants={fadeIn}>
              {line}
            </motion.p>
          ))}
        </motion.div>
      </Slide>

      {/* ── Screen 3: Problem ──────────────────────────────────────────────── */}
      <Slide id={2} {...slideProps}>
        <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis mb-12">
          The problem we noticed.
        </motion.h2>
        <motion.div variants={staggerContainer} className="max-w-3xl space-y-5 font-georgia-pro text-lg md:text-xl text-gray-700">
          <motion.p variants={fadeIn}>
            As Community Manager at Highsnobiety — an audience of 10M+ — the gap was clear.
          </motion.p>
          <motion.p variants={fadeIn} className="text-2xl font-adonis text-black italic">
            For both audiences and interview subjects, the answer was often: "I don't want to download another app."
          </motion.p>
          <motion.p variants={fadeIn}>
            Fragmented platforms for different purposes. Building community became guesswork.
          </motion.p>
          <motion.p variants={fadeIn}>
            The solution: a custom home for community, conversation, and media — embedded in the brand.
          </motion.p>
        </motion.div>
      </Slide>

      {/* ── Screen 4: Chat Demo – Framework / Menu ─────────────────────────── */}
      <Slide id={3} {...slideProps} className="bg-white">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div className="space-y-6 order-2 md:order-1">
            <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis">
              The Framework
            </motion.h2>
            <motion.p variants={fadeIn} className="font-georgia-pro text-lg text-gray-700">
              Our chat is built entirely on-chain, using Towns Protocol for messaging as well as $TOWNS for rewards.
            </motion.p>
          </div>
          {/* Right: chat mock */}
          <motion.div variants={fadeIn} className="order-1 md:order-2 relative h-[420px] rounded-2xl overflow-hidden shadow-2xl">
            <ChatBackground />
            <ChatMockMenu visible={true} />
            <div className="absolute inset-0 bg-black/40 z-10" />
          </motion.div>
        </div>
      </Slide>

      {/* ── Screen 5: Chat Demo – Participant / Knead Monthly ──────────────── */}
      <Slide id={4} {...slideProps} className="bg-white">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div className="space-y-6">
            <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis">
              The Knead Monthly Experience
            </motion.h2>
            <motion.p variants={fadeIn} className="font-georgia-pro text-lg text-gray-700">
              When a Knead Monthly subscriber joins, they'll be able to comment during events — interviews, AMAs, office
              hours — which enables them to earn $TOWNS, eventually graduating to Contributor.
            </motion.p>
          </div>
          {/* Right: wallet mock */}
          <motion.div variants={fadeIn} className="flex flex-col items-center gap-8">
            <div className="relative h-[360px] w-full rounded-2xl overflow-hidden shadow-xl">
              <ChatBackground />
              <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center">
                <WalletMock mode="participant" visible={true} />
              </div>
            </div>
            {/* Earnings placeholder */}
            <div className="w-full max-w-sm bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
              <p className="text-xs text-gray-400 font-georgia-pro mb-2">Earnings snapshot</p>
              <p className="font-adonis text-3xl text-black">1,240 $TOWNS</p>
              <p className="text-sm text-gray-500 font-georgia-pro mt-1">earned from 14 events</p>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* ── Screen 6: Chat Demo – Contributor ──────────────────────────────── */}
      <Slide id={5} {...slideProps} className="bg-white">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div className="space-y-6">
            <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis">
              Upgrading to Contributor
            </motion.h2>
            <motion.div variants={staggerContainer} className="font-georgia-pro text-lg text-gray-700 space-y-3">
              {[
                "Full access: messaging all the time, persona/profile picture, DMs.",
                "VIPs + earned members.",
                "Weekly allowance from Treasury.",
                "20% $TOWNS cashback on 'likes'.",
                "Use-it-or-lose-it basis.",
                "Passive income while retaining highest status.",
              ].map((line, i) => (
                <motion.p key={i} variants={fadeIn} className="flex gap-2">
                  <span className="text-black mt-1">—</span>
                  <span>{line}</span>
                </motion.p>
              ))}
            </motion.div>
          </div>
          {/* Right: wallet mock + profile picture placeholder */}
          <motion.div variants={fadeIn} className="flex flex-col items-center gap-6">
            <div className="relative h-[340px] w-full rounded-2xl overflow-hidden shadow-xl">
              <ChatBackground />
              <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center">
                <WalletMock mode="contributor" visible={true} />
              </div>
            </div>
            {/* Profile picture placeholder */}
            <div className="w-full max-w-sm bg-gray-50 border border-gray-200 rounded-xl p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                <span className="font-adonis text-white text-xl">C</span>
              </div>
              <div>
                <p className="font-adonis text-black">contributor.knead</p>
                <p className="text-sm text-gray-500 font-georgia-pro">Custom persona · DMs unlocked</p>
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* ── Screen 7: Video Streaming ───────────────────────────────────────── */}
      <Slide id={6} {...slideProps}>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div className="space-y-6">
            <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis">
              Community-Driven, Scalable Compliance
            </motion.h2>
            <motion.div variants={staggerContainer} className="font-georgia-pro text-lg text-gray-700 space-y-3">
              {[
                "Hub for thoughtful engagement.",
                "Live video/audio streaming, gamified experiences, file uploads.",
                "Onboarding: copy/paste wallet address.",
                "ThirdWeb non-custodial wallets — users own wallets, can export private keys.",
                "Custom smart contract on Base.",
                "All transactions on-chain — Knead never touches funds.",
                "Not a money transmitter.",
                "Compliance stack with Towns Protocol backbone.",
                "Knead as proof of concept.",
              ].map((line, i) => (
                <motion.p key={i} variants={fadeIn} className="flex gap-2">
                  <span className="text-black mt-1">—</span>
                  <span>{line}</span>
                </motion.p>
              ))}
            </motion.div>
          </div>
          {/* Right: video stage mock */}
          <motion.div variants={fadeIn} className="bg-black rounded-2xl overflow-hidden shadow-2xl aspect-video flex flex-col">
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black relative">
              {/* Simulated video stage */}
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-4">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="white" opacity="0.8">
                    <path d="M23 7L16 12L23 17V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" fill="white" opacity="0.8" />
                  </svg>
                </div>
                <p className="text-white/60 text-sm font-georgia-pro">Live Event Stream</p>
                <p className="text-white/40 text-xs font-georgia-pro mt-1">142 viewers · Powered by Daily.co</p>
              </div>
              {/* Simulated chat panel overlay */}
              <div className="absolute right-0 top-0 bottom-0 w-32 bg-black/70 border-l border-white/10 p-2 overflow-hidden">
                {["🔥 so good", "amazing 👏", "👀", "let's go!", "🎉"].map((msg, i) => (
                  <p key={i} className="text-white/60 text-xs font-georgia-pro mb-1">{msg}</p>
                ))}
              </div>
            </div>
            <div className="px-4 py-2 bg-black/80 flex items-center gap-2 border-t border-white/10">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <p className="text-white/70 text-xs font-georgia-pro">LIVE</p>
              <p className="text-white/40 text-xs font-georgia-pro ml-auto">Knead AMA — Feb 2026</p>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* ── Screen 8: Ask, Budget, Bonuses ─────────────────────────────────── */}
      <Slide id={7} {...slideProps}>
        <div className="space-y-20">

          {/* Section 1: The Ask */}
          <div>
            <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis mb-8">
              Our Ask + Timeline
            </motion.h2>
            <motion.p variants={fadeIn} className="font-georgia-pro text-lg text-gray-700 mb-8 max-w-3xl">
              Knead would like Towns to engage on a 5-month sprint, funding our /chat activation + relaunch with $TOWNS
              as a living case study to activate our fashion, art, culture, music, and other audiences. Here's our
              top-line goals:
            </motion.p>
            <motion.div variants={staggerContainer} className="space-y-4 mb-12">
              {[
                "A selective group of VIPs/influencers from our time at Highsnobiety + Knead in the chat — across major fashion brands, music labels, galleries, and tech companies.",
                "Turn 1–2 of these leads into sales prospects for Knead to build them a custom chat platform, working with Towns on strategy to build a stronger portfolio of brands for both companies.",
                "Create an observable sales audience for Towns to build its media verticals.",
              ].map((goal, i) => (
                <motion.div key={i} variants={fadeIn} className="flex gap-4">
                  <span className="font-adonis text-black text-lg mt-0.5">{i + 1}.</span>
                  <p className="font-georgia-pro text-lg text-gray-700">{goal}</p>
                </motion.div>
              ))}
            </motion.div>

            <motion.h3 variants={fadeIn} className="text-2xl font-adonis mb-4 text-gray-800">If Successful</motion.h3>
            <motion.div variants={staggerContainer} className="space-y-3 mb-12">
              {[
                "Knead has built enough of a foundation that a larger $TOWNS grant could be used to bolster our platform as the future of media: creating a studio and merchandise arm.",
                "Knead acquires its own tech clients with our stack, creating an entirely new division of our company as a development agency.",
              ].map((item, i) => (
                <motion.div key={i} variants={fadeIn} className="flex gap-4">
                  <span className="font-adonis text-black text-lg mt-0.5">{i + 1}.</span>
                  <p className="font-georgia-pro text-lg text-gray-700">{item}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Budget Breakdown */}
          <div>
            <motion.h3 variants={fadeIn} className="text-3xl font-adonis mb-4">Budget Breakdown</motion.h3>
            <motion.div variants={fadeIn} className="bg-gray-50 border border-gray-200 rounded-2xl p-8 mb-8">
              <p className="font-adonis text-2xl text-black mb-2">
                $10,000/month retainer paid in $TOWNS to Knead
              </p>
              <p className="font-adonis text-xl text-gray-600">
                + $2,000/month in $TOWNS sent directly to Knead Treasury
              </p>
            </motion.div>
            <motion.div variants={staggerContainer} className="space-y-6">
              {[
                {
                  title: "Magazine operations + editorial",
                  body: "Original photography/videography/design for 10 stories for relaunch (slated: May 26). Editorial. Website Hosting. Legal Expenses. Coworking.",
                  estimate: "$4–6k/month",
                },
                {
                  title: "Treasury Budget",
                  body: "The $2,000/month in $TOWNS for the chat helps strengthen recruitment for VIPs/influencers. Not only do they know there's a real amount they'll be able to start pulling 'cashback' from, but creates intrigue/interest in what Towns Protocol is.",
                  estimate: "$2k/month",
                },
                {
                  title: "Travel/Lodging",
                  body: "As part of building anticipation for our relaunch, we'll document what it's like to create the stories we'll be releasing in May, giving the chat teaser content + exclusive looks.",
                  estimate: "$2–4k/month for Editor + 1 photographer/videographer",
                },
              ].map((item, i) => (
                <motion.div key={i} variants={fadeIn} className="border-l-2 border-black pl-6">
                  <p className="font-adonis text-xl text-black mb-1">{item.title}</p>
                  <p className="font-georgia-pro text-gray-700 mb-2">{item.body}</p>
                  <p className="font-adonis text-sm text-gray-500">Estimated: {item.estimate}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Bonuses */}
          <div>
            <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis mb-4">Bonuses</motion.h2>
            <motion.p variants={fadeIn} className="font-georgia-pro text-lg text-gray-700 mb-12">
              Upon reaching benchmarks for Month 3 approvals, $TOWNS bonuses to fund:
            </motion.p>

            {/* Bonus 1: S-Tier */}
            <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-10 items-start mb-16">
              <div className="space-y-4">
                <h3 className="font-adonis text-2xl">The S-Tier Line</h3>
                <p className="font-georgia-pro text-gray-700">
                  NFC-enabled clothing (hoodie, crewneck, pocket t-shirt, and dad hat). Gifted to our Contributors as
                  our VIP-seeding before Fall line launch, the S-Tier will enable users to tap the S-Tier (S) tag and
                  give a Contributor membership to a friend (includes an annual Knead membership from the point of
                  redemption too). This drives another batch of influencers to Knead + Towns, creating more sales leads
                  from a group we've already been successful with giving a top level experience.
                </p>
                <p className="font-georgia-pro text-sm text-gray-500">Partners: IYK for NFC-chips</p>
                <p className="font-adonis text-gray-700">Estimated: $35–40k for 200–250 people</p>
              </div>
              {/* S-Tier hoodie mockup placeholder */}
              <div className="bg-gray-100 rounded-2xl overflow-hidden aspect-square flex items-center justify-center">
                <div className="text-center p-8">
                  <p className="font-adonis text-4xl text-black mb-2">S</p>
                  <p className="font-georgia-pro text-gray-500 text-sm">S-Tier Hoodie Mockup</p>
                  <p className="font-georgia-pro text-gray-400 text-xs mt-1">NFC-enabled · Limited Edition</p>
                </div>
              </div>
            </motion.div>

            {/* Bonus 2: Blvck Svm Dinner */}
            <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-10 items-start mb-16">
              <div className="space-y-4">
                <h3 className="font-adonis text-2xl">Blvck Svm Dinner</h3>
                <p className="font-georgia-pro text-gray-700">
                  5 spots for our Blvck Svm Dinner in Richmond, VA. Knead will be inviting the rapper Blvck Svm to the
                  Branch Museum in Richmond for an exclusive michelinman dinner pairing. Partnering with Michelin-star
                  chefs around the country, Blvck Svm has been offering diners an intimate experience of breaking down
                  each song off his album michelinman, with the chef defining a dish to accompany. We'd like to fly five
                  Contributors from the chat in for an all expenses paid experience, highlighting an exclusive
                  experience only for superfans/VIPs.
                </p>
                <p className="font-adonis text-gray-700">Estimated: $15–20k for 5 people</p>
              </div>
              <SwipeableCarousel
                images={dinnerPartyPhotos}
                currentIndex={currentDinnerPhoto}
                setCurrentIndex={setCurrentDinnerPhoto}
                height="360px"
              />
            </motion.div>
          </div>

          {/* Timeline */}
          <div>
            <motion.h3 variants={fadeIn} className="text-3xl font-adonis mb-10">Timeline</motion.h3>
            <motion.div variants={staggerContainer} className="space-y-8">
              {[
                {
                  month: "Month 1 — Private Beta (Tentatively March 2026)",
                  items: [
                    "Finish testing with friends/family, begin onboarding influencers as Contributors.",
                    "Schedule 1–2 exclusive events for Contributors.",
                    "Do 1 reward from PR network (free products).",
                    "Invite PR companies, especially top-tier who specialize in high-end product samples.",
                  ],
                },
                {
                  month: "Month 2",
                  items: [
                    "Event schedule ramps up (minimum: 1 event per week).",
                    "With permission, make Contributors a point of conversation.",
                    "Start teasing content for upcoming Knead relaunch.",
                    "Engage nearly daily with Contributors.",
                    "Meetings with PR agencies/brands.",
                    "Begin outreach for B2B sales.",
                    "Minimum 100 Contributors in chat.",
                  ],
                },
                {
                  month: "Month 3 — Tentative Public Release (May 26)",
                  items: [
                    "Tease upcoming content.",
                    "Announce chat + make it public. Announce total Treasury.",
                    "Have 3 months of events booked (June–Aug).",
                    "3–5 intro calls established for sales calls.",
                    "If budget: samples developed + teaser photos of S-Tier clothing.",
                    "Announce first IRL event: Blvck Svm michelinman dinner.",
                    "Minimum 150 Contributors in chat.",
                  ],
                },
                {
                  month: "Month 4",
                  items: [
                    "Ongoing events + activations in full effect.",
                    "Outreach for guest streams/takeovers (Boiler Rooms, etc).",
                    "1–2 sales calls at meeting 2–3 in the pipeline.",
                    "Contributors get S-Tier reservations.",
                    "Photography + teasers for S-Tier drop to general public.",
                    "Minimum 175 Contributors + 250 Knead Members.",
                  ],
                },
                {
                  month: "Month 5",
                  items: [
                    "Continuing weekly events + activations.",
                    "First IRL event complete (Blvck Svm dinner).",
                    "1 quality sales lead for Towns Protocol development.",
                    "S-Tier line mailed to Contributors + redemption portal established.",
                    "Larger $TOWNS grant unlocked to ramp up all activations.",
                    "175+ Contributors, 250+ Members.",
                  ],
                },
              ].map((month, i) => (
                <motion.div key={i} variants={fadeIn} className="border border-gray-200 rounded-2xl p-6">
                  <h4 className="font-adonis text-xl text-black mb-4">{month.month}</h4>
                  <ul className="space-y-2">
                    {month.items.map((item, j) => (
                      <li key={j} className="font-georgia-pro text-gray-700 flex gap-2">
                        <span className="text-gray-300 mt-1">·</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Benchmarks */}
          <div>
            <motion.h3 variants={fadeIn} className="text-3xl font-adonis mb-8 text-center">Final Benchmarks</motion.h3>
            <motion.div variants={staggerContainer} className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: "Contributors", value: "175+" },
                { label: "Members", value: "250+" },
                { label: "Enterprise sales leads", value: "1 qualified" },
                { label: "More leads in pipeline", value: "3–5" },
              ].map((b, i) => (
                <motion.div key={i} variants={fadeIn} className="border border-gray-200 rounded-2xl p-6 text-center">
                  <p className="font-adonis text-3xl text-black mb-2">{b.value}</p>
                  <p className="font-georgia-pro text-sm text-gray-500">{b.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </Slide>

      {/* ── Screen 9: The Big Deal ──────────────────────────────────────────── */}
      <Slide id={8} {...slideProps}>
        <div className="text-center max-w-3xl mx-auto space-y-10">
          <motion.h2 variants={fadeIn} className="text-4xl md:text-6xl font-adonis">
            The Big Deal
          </motion.h2>
          {[
            "Knead + Towns can show the creative industry that the future of media is a /chat.",
            "Especially with the rise of AI, more brands will be taking a serious look at owning the means of distribution for their media.",
            "We're returning to an era where a brand can own the full experience on their website. You know, a time where the internet can be fun again.",
            "That's why, together, we can build a place for those memories to exist, starting with /chat.",
          ].map((para, i) => (
            <motion.p key={i} variants={fadeIn} className="font-georgia-pro text-xl md:text-2xl text-gray-700 leading-relaxed">
              {para}
            </motion.p>
          ))}
        </div>
      </Slide>

      {/* ── Screen 10: Closing ─────────────────────────────────────────────── */}
      <Slide id={9} {...slideProps}>
        <div className="text-center">
          <motion.p variants={fadeIn} className="font-georgia-pro text-3xl md:text-4xl text-gray-600 italic">
            Thanks for reading.
          </motion.p>
        </div>
      </Slide>
    </div>
  )
}
