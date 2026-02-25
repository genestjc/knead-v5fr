"use client"

import React, { useState, useEffect, useRef, type TouchEvent } from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import { ChatLayout } from "@/components/chat/ChatLayout"
import { WalletSummary } from "@/components/wallet-summary"

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: "easeOut" },
  },
}

const staggerContainer = {
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
  raw = false,
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

  if (raw) {
    return (
      <div
        ref={(el) => { slideRefs.current[id] = el }}
        className={`min-h-screen relative overflow-hidden ${className}`}
      >
        {children}
      </div>
    )
  }

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
          Every company will have a /chat
        </motion.h2>
        <motion.div variants={staggerContainer} className="max-w-3xl mx-auto space-y-5 font-georgia-pro text-lg md:text-xl text-gray-700">
          {[
            "The internet is moving in-house.",
            "By shifting from platforms to protocols, brands are able to build communities natively on their own website, customizing a framework exclusively for their fans.",
            "Whether that's a home for live video streaming, a gamified reward system, or a combination of everything in-between, the most engaging spaces will be shifting off social media and into digital experiences directly between companies and their most loyal supporters.",
            'When our current digital era started, the saying was: "Every company is a media company."',
            "However, we lost sight of what it meant to own how that media's distributed.",
            "As a magazine on the forefront of digital culture, Knead's /chat isn't just changing how we engage with our community, but providing the infrastructure for brands to design a custom media experience themselves.",
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
            Working as Community Manager at Highsnobiety, I identified a gap in trying to reach our audience of 10 million+ people:
          </motion.p>
          <motion.ul variants={fadeIn} className="list-disc pl-6 space-y-4">
            <li>For our followers, it was &quot;I don&apos;t want to download another app&quot;. For our interview subjects, the same hesitation existed, wondering if it was worth the effort and time.</li>
            <li>Not only did this require people to sign up for separate platforms but ones that would host different technical purposes: one for audio streaming, another for conversation, etc.</li>
            <li>Building community becomes a fragmented practice of guess-work rather than concentrating on identifying and rewarding the most loyal fans.</li>
          </motion.ul>
          <motion.p variants={fadeIn}>
            Instead, what if we could build everyone a custom home for community, conversation, and media?
          </motion.p>
          <motion.p variants={fadeIn}>
            Well, that&apos;s exactly what we did.
          </motion.p>
        </motion.div>
      </Slide>

      {/* ── Screen 4: Chat Demo – Framework / Menu ─────────────────────────── */}
      <Slide id={3} {...slideProps} raw className="bg-white">
        {/* Dimmed ChatLayout background */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <ChatLayout>
            <div className="h-full bg-gray-100" />
          </ChatLayout>
        </div>
        {/* Overlay content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <div className="max-w-4xl bg-white/95 backdrop-blur-sm p-8 md:p-12 rounded-2xl shadow-xl">
            <h2 className="font-adonis text-4xl md:text-5xl mb-8 text-black">
              The Framework
            </h2>
            <p className="font-georgia-pro text-lg md:text-xl text-black">
              Our chat is built entirely on-chain, using Towns Protocol for messaging as well as $TOWNS for rewards.
            </p>
          </div>
        </div>
      </Slide>

      {/* ── Screen 5: Chat Demo – Participant / Knead Monthly ──────────────── */}
      <Slide id={4} {...slideProps} raw className="bg-white">
        {/* Dimmed ChatLayout background */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <ChatLayout>
            <div className="h-full bg-gray-100" />
          </ChatLayout>
        </div>
        {/* Overlay content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <div className="max-w-6xl grid md:grid-cols-2 gap-8 items-center">
            <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-xl">
              <h2 className="font-adonis text-4xl md:text-5xl mb-6 text-black">
                The Knead Monthly Experience
              </h2>
              <p className="font-georgia-pro text-lg md:text-xl text-black">
                When a Knead Monthly subscriber joins, they'll be able to comment during events (interviews, AMAs, office hours, etc), which enables them to earn $TOWNS, eventually graduating to Contributor.
              </p>
            </div>
            <div className="bg-white/95 backdrop-blur-sm p-6 rounded-2xl shadow-xl">
              <div className="mb-4">
                <WalletSummary context="chat" />
              </div>
            </div>
          </div>
        </div>
      </Slide>

      {/* ── Screen 6: Chat Demo – Contributor ──────────────────────────────── */}
      <Slide id={5} {...slideProps} raw className="bg-white">
        {/* Dimmed ChatLayout background */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <ChatLayout>
            <div className="h-full bg-gray-100" />
          </ChatLayout>
        </div>
        {/* Overlay content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <div className="max-w-6xl grid md:grid-cols-2 gap-8 items-center">
            <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-xl">
              <h2 className="font-adonis text-4xl md:text-5xl mb-6 text-black">
                Upgrading to Contributor
              </h2>
              <div className="space-y-4 font-georgia-pro text-lg md:text-xl text-black">
                <p>Contributors are given full access to the chat, including messaging all the time, a persona/profile picture, and DMs. These are VIPs + earned members.</p>
                <p>Contributors are given a weekly allowance from the Treasury to spend on others, earning 20% $TOWNS back for each 'like' they give. Allowances don't roll over and are on a 'use-it-or-lose it' basis. This enables VIPs + earned members to make passive income while retaining the highest status.</p>
              </div>
            </div>
            <div className="bg-white/95 backdrop-blur-sm p-6 rounded-2xl shadow-xl">
              <div className="mb-4">
                <WalletSummary context="chat" />
              </div>
            </div>
          </div>
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
            <motion.div variants={staggerContainer} className="font-georgia-pro text-lg text-gray-700 space-y-4">
              <motion.p variants={fadeIn}>
                Knead&apos;s chat is designed to be a hub for thoughtful engagement.
              </motion.p>
              <motion.p variants={fadeIn}>
                With capabilities for live video/audio streaming, gamified experiences, file uploads, + more, our framework can be the example for hosting enriching experiences for brands and creators alike. Onboarding is as simple as copy/pasting a wallet address.
              </motion.p>
              <motion.p variants={fadeIn} className="font-bold text-black">
                These enticing features are paired with a fast, scalable tech stack that&apos;s regulatory compliant.
              </motion.p>
              <motion.ul variants={fadeIn} className="list-disc pl-6 space-y-2">
                <li>We use ThirdWeb non-custodial wallets, which means users own their wallets + can export their private keys.</li>
                <li>By designing our reward systems through a custom smart contract on Base, all transactions occur on-chain, meaning Knead never touches the funds.</li>
                <li>This model can be applied to any company who wants a reward system with real-world value without being considered a money transmitter.</li>
              </motion.ul>
              <motion.p variants={fadeIn}>
                This is a compliance stack with Towns Protocol as the backbone that&apos;s easily adoptable, with Knead as the proof of concept.
              </motion.p>
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
        <div className="max-w-4xl space-y-8">
          <motion.h2 variants={fadeIn} className="text-5xl md:text-7xl font-adonis mb-12">
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
          <motion.p variants={fadeIn} className="pt-8">
            <a
              href="https://kneadmag.com/chat"
              target="_blank"
              rel="noopener noreferrer"
              className="font-georgia-pro text-xl md:text-2xl text-blue-600 hover:text-blue-800 underline"
            >
              Check out our chat at kneadmag.com/chat to experience it yourself
            </a>
          </motion.p>
        </div>
      </Slide>

      {/* ── Screen 10: Closing ─────────────────────────────────────────────── */}
      <Slide id={9} {...slideProps}>
        <div className="text-center">
          <motion.h2 variants={fadeIn} className="font-adonis text-5xl md:text-7xl text-black">
            Thanks for reading.
          </motion.h2>
        </div>
      </Slide>
    </div>
  )
}
