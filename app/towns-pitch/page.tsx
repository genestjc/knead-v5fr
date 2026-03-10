"use client"

import React, { useState, useEffect, useRef, type TouchEvent } from "react"
import Image from "next/image"
import { motion } from "framer-motion"

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
  const dinnerPartyPhotos = [
    '/dinner-party-1.jpg',
    '/dinner-party-2.jpg',
    '/dinner-party-3.jpg',
    '/dinner-party-4.jpg',
    '/dinner-party-5.jpg',
    '/dinner-party-6.jpg',
    '/dinner-party-7.jpg',
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

      {/* ── Screen 4: Framework ────────────────────────────────────────────── */}
      <Slide id={3} {...slideProps} raw className="bg-white">
        <div className="absolute inset-0">
          <Image
            src="/chatlayout.png"
            alt="Chat interface"
            fill
            className="object-cover opacity-20"
          />
        </div>
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-3xl">
            <h2 className="font-adonis text-4xl md:text-6xl mb-8 text-black">
              The Framework
            </h2>
            <p className="font-georgia-pro text-lg md:text-xl text-black">
              Our chat is built entirely on-chain, using Towns Protocol for messaging as well as $TOWNS for rewards.
            </p>
          </div>
        </div>
      </Slide>

      {/* ── Screen 5: Knead Monthly ────────────────────────────────────────── */}
      <Slide id={4} {...slideProps} className="bg-white">
        <div className="max-w-6xl grid md:grid-cols-2 gap-12 items-center">
          <div>
            <motion.h2 variants={fadeIn} className="font-adonis text-4xl md:text-5xl mb-6 text-black">
              The Knead Monthly Experience
            </motion.h2>
            <motion.p variants={fadeIn} className="font-georgia-pro text-lg md:text-xl text-black">
              When a Knead Monthly subscriber joins, they'll be able to comment during events (interviews, AMAs, office hours, etc), which enables them to earn $TOWNS, eventually graduating to Contributor.
            </motion.p>
          </div>
          <motion.div variants={fadeIn} className="flex justify-center">
            <Image
              src="/Knead Monthly Settings.png"
              alt="Participant menu"
              width={350}
              height={500}
              className="rounded-xl shadow-2xl"
            />
          </motion.div>
        </div>
      </Slide>

      {/* ── Screen 6: Contributor ───────────────────────────────────────────── */}
      <Slide id={5} {...slideProps} className="bg-white">
        <div className="max-w-6xl grid md:grid-cols-2 gap-12 items-center">
          <div>
            <motion.h2 variants={fadeIn} className="font-adonis text-4xl md:text-5xl mb-6 text-black">
              Upgrading to Contributor
            </motion.h2>
            <motion.div variants={staggerContainer} className="space-y-4 font-georgia-pro text-lg md:text-xl text-black">
              <motion.p variants={fadeIn}>Contributors are given full access to the chat, including messaging all the time, a persona/profile picture, and DMs. These are VIPs + earned members.</motion.p>
              <motion.p variants={fadeIn}>Contributors are given a weekly allowance from the Treasury to spend on others, earning 20% $TOWNS back for each 'like' they give. Allowances don't roll over and are on a 'use-it-or-lose it' basis. This enables VIPs + earned members to make passive income while retaining the highest status.</motion.p>
            </motion.div>
          </div>
          <motion.div variants={fadeIn} className="flex justify-center">
            <Image
              src="/Contributor Settings.png"
              alt="Contributor menu"
              width={350}
              height={500}
              className="rounded-xl shadow-2xl"
            />
          </motion.div>
        </div>
      </Slide>

      {/* ── Screen 7: Compliance ────────────────────────────────────��───────── */}
      <Slide id={6} {...slideProps}>
        <div className="grid md:grid-cols-2 gap-12 items-start">
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
          <motion.div variants={fadeIn} className="space-y-6">
            <Image
              src="/VideoScreenExample.png"
              alt="Live video event"
              width={500}
              height={350}
              className="rounded-xl shadow-lg w-full"
            />
            <Image
              src="/Engagement Example.png"
              alt="32 $TOWNS tip example"
              width={500}
              height={250}
              className="rounded-xl shadow-lg w-full"
            />
          </motion.div>
        </div>
      </Slide>

      {/* ── Screen 8: Our Ask + Timeline ───────────────────────────────────── */}
      <Slide id={7} {...slideProps} raw className="bg-white">
        <div className="min-h-screen py-20 px-6 md:px-16">
          <div className="max-w-6xl mx-auto space-y-20">

            {/* Header */}
            <motion.h2 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="font-adonis text-5xl md:text-6xl text-black"
            >
              Our Ask + Timeline
            </motion.h2>

            {/* Goals */}
            <div>
              <p className="font-georgia-pro text-lg md:text-xl mb-6 text-black">
                Knead would like Towns to engage on a 5-month long sprint, funding our /chat activation + relaunch with $TOWNS as a living case study to activate our fashion, art, culture, music, and other audiences. Here's our top-line goals:
              </p>
              <ul className="font-georgia-pro text-lg space-y-4 list-disc pl-6 text-black">
                <li>A selective group of VIPs/influencers from our time at Highsnobiety + Knead in the chat. These include Knead supporters across major fashion brands, music labels, galleries, and tech companies.</li>
                <li>Turn 1-2 of these leads into sales prospects for Knead to build them a custom chat platform, working with Towns on strategy to build a stronger portfolio of brands for both companies.</li>
                <li>Create an observable sales audience for Towns to build its media verticals.</li>
              </ul>
            </div>

            {/* If Successful */}
            <div>
              <p className="font-georgia-pro text-lg md:text-xl mb-6 text-black">
                If successful, the outcomes would include:
              </p>
              <ul className="font-georgia-pro text-lg space-y-4 list-disc pl-6 text-black">
                <li>Knead has built enough of a foundation that a larger $TOWNS grant could be used to only bolster our platform as the future of media: creating a studio and merchandise arm.</li>
                <li>Knead acquires its own tech clients with our stack, creating an entirely new division of our company as a development agency.</li>
              </ul>
            </div>

            {/* Budget */}
            <div>
              <h3 className="font-adonis text-3xl md:text-4xl mb-6 text-black">Our Ask</h3>
              <p className="font-georgia-pro text-lg md:text-xl mb-6 text-black">
                $10,000/month retainer paid in $TOWNS to Knead + $2,000/month in $TOWNS sent directly to Knead Treasury. Here's how it'll be spent on a month-to-month basis:
              </p>
              <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <p className="font-georgia-pro text-black"><strong>Budget for magazine operations + editorial.</strong> Original photography/videography/design for 10 stories for relaunch (slated: May 26). Editorial. Website Hosting. Legal Expenses. Coworking. Estimated: $4-6k/month</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <p className="font-georgia-pro text-black"><strong>Treasury Budget.</strong> The $2,000/month in $TOWNS for the chat helps strengthen recruitment for VIP/influencers. Not only do they know there's a real amount they'll be able to start pulling 'cashback' from, but create intrigue/interest in what Towns Protocol is.</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <p className="font-georgia-pro text-black"><strong>Travel/Lodging.</strong> As part of building anticipation for our relaunch, we'll document what it's like to create the stories we'll be releasing in May, giving the chat teaser content + exclusive looks. Estimated: $2-4k/month for Editor + 1 photographer/videographer</p>
                </div>
              </div>
            </div>

            {/* Bonuses */}
            <div>
              <h3 className="font-adonis text-3xl md:text-4xl mb-6 text-black">Bonuses</h3>
              <p className="font-georgia-pro text-lg mb-8 text-black">
                Upon reaching benchmark of 150 Contributors (Month 3 quota) approvals for $TOWNS to fund:
              </p>

              {/* S-Tier Line */}
              <div className="grid md:grid-cols-2 gap-12 mb-12 items-start">
                <div>
                  <h4 className="font-adonis text-2xl mb-4 text-black">The S-Tier Line</h4>
                  <div className="font-georgia-pro text-base space-y-4 text-black">
                    <p>NFC-enabled clothing. Gifted to our Contributors as VIP-seeding before Fall line launch, the S-Tier will enable users to tap the S-Tier (S) tag and give a Contributor membership to a friend (includes an annual Knead membership from the point of redemption too). This drives another batch of influencers to Knead + Towns, creating more sales leads from a group we've already been successful with giving a top level experience.</p>
                    <p>The S-Tier line will be how we distribute our semi-annual and annual memberships, as well as via our print magazine.</p>
                    <p>IYK for NFC-chips.</p>
                    <p>Estimated cost: $35-40k for 200-250 people</p>
                  </div>
                </div>
                <div>
                  <Image
                    src="/mock-up.png"
                    alt="S-Tier hoodie with K logo and S badge"
                    width={500}
                    height={600}
                    className="rounded-xl w-full"
                  />
                </div>
              </div>

              {/* Knead Print Magazine */}
              <div className="grid md:grid-cols-2 gap-12 mb-12 items-start">
                <div>
                  <h4 className="font-adonis text-2xl mb-4 text-black">Knead Print Magazine</h4>
                  <div className="font-georgia-pro text-base space-y-4 text-black">
                    <p>NFC-enabled magazine. Gifted alongside our S-Tier line and unveiled at our Blvck Svm dinner below, the print magazine will have an NFC chip to enable our semi-annual membership. As an additional gift to contributors, enables another access point to onboard into the chat.</p>
                    <p>Estimated cost: $18,000 for 300 copies, including copy editor + photography + design.</p>
                  </div>
                </div>
                <div>
                  <Image
                    src="/print-magazine-mockup.png"
                    alt="Knead Print Magazine mockup"
                    width={500}
                    height={600}
                    className="rounded-xl w-full"
                  />
                </div>
              </div>

              {/* Blvck Svm Dinner */}
              <div className="grid md:grid-cols-2 gap-12 items-start">
                <div>
                  <h4 className="font-adonis text-2xl mb-4 text-black">5 Spots for our Blvck Svm Dinner in Richmond, VA</h4>
                  <div className="font-georgia-pro text-base space-y-4 text-black">
                    <p>Knead will be inviting the rapper Blvck Svm to the Branch Museum in Richmond for an exclusive michelinman dinner pairing.</p>
                    <p>Partnering with Michelin-star chefs around the country, Blvck Svm has been offering diners an intimate experience of breaking down each song off his album michelinman, with the chef defining a dish to accompany.</p>
                    <p>We'd like to fly five Contributors from the chat in for an all expenses paid experience, highlighting an exclusive experience only for superfans/VIPs. Other Contributors will be able to nominate and vote on who should be treated to the experience.</p>
                    <p>Estimated costs: $15-20k for 5 people</p>
                  </div>
                </div>
                <SwipeableCarousel
                  images={dinnerPartyPhotos}
                  currentIndex={currentDinnerPhoto}
                  setCurrentIndex={setCurrentDinnerPhoto}
                  height="400px"
                />
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h3 className="font-adonis text-3xl md:text-4xl mb-8 text-black">Timeline</h3>
              <div className="space-y-8">

                {/* Month 1 */}
                <div>
                  <h4 className="font-adonis text-2xl mb-4 text-black">Month 1 (Tentatively, March 2026 - Private Beta)</h4>
                  <ul className="font-georgia-pro text-base space-y-2 list-disc pl-6 text-black">
                    <li>Finish testing with friends/family, begin onboarding influencers/noteworthy guests as Contributors</li>
                    <li>Schedule 1-2 exclusive events for Contributors (can be open hours with video feed, watching a Knead interview live).</li>
                    <li>Do 1 reward from PR network (free products)</li>
                    <li>Invite PR companies, especially top-tier who specialize in high-end products/product samples (explain benefit of Contributor group as powerful marketing segment of influencers).</li>
                  </ul>
                </div>

                {/* Month 2 */}
                <div>
                  <h4 className="font-adonis text-2xl mb-4 text-black">Month 2</h4>
                  <ul className="font-georgia-pro text-base space-y-2 list-disc pl-6 text-black">
                    <li>Event schedule ramps up as we onboard more Contributors (by week two, minimum: 1 event per week- can be open hours, interview/AMA, giveaway, portfolio review…anything to get the flow of events up).</li>
                    <li>With permission, make Contributors a point of conversation: "Tell us about leading marketing initiatives at Pepsi" (the conversation is content).</li>
                    <li>Starting teasing content for upcoming Knead relaunch- drop exclusive photos from interviews.</li>
                    <li>Engage nearly daily with Contributors, asking questions and posting photos, encouraging regular contributions.</li>
                    <li>Meetings with PR agencies/brands for upcoming rollouts of products/services that can be exclusively given away to Contributors in chat.</li>
                    <li>Begin outreach for b2b sales of selling /chat as a product.</li>
                    <li>Minimum 100 Contributors in chat</li>
                  </ul>
                </div>

                {/* Month 3 */}
                <div>
                  <h4 className="font-adonis text-2xl mb-4 text-black">Month 3 (Tentative Public Release: May 26)</h4>
                  <ul className="font-georgia-pro text-base space-y-2 list-disc pl-6 text-black">
                    <li>Tease upcoming content for tentative late May relaunch</li>
                    <li>Announce chat + make it public. Announce total Treasury of $TOWNS/partnership.</li>
                    <li>Have 3-months of events booked (June-Aug) to continue partnership (minimum: 3 per month)</li>
                    <li>3-5 intro calls established for sales calls.</li>
                    <li>If budget, samples developed + teaser photos sent to chat of Knead's first line of NFC-enabled clothing (S-Tier- fall drop).</li>
                    <li>Announce first IRL event: Blvck Svm michelinman dinner. Depending on budget, RSVP spot to 5 chat members (VIP treatment: flown-in, attend dinner/show after, hotel accommodations).</li>
                    <li>Minimum 150 Contributors in chat</li>
                  </ul>
                </div>

                {/* Month 4 */}
                <div>
                  <h4 className="font-adonis text-2xl mb-4 text-black">Month 4</h4>
                  <ul className="font-georgia-pro text-base space-y-2 list-disc pl-6 text-black">
                    <li>Ongoing events + activations in chat now full-effect</li>
                    <li>Outreach for guest streams/takeovers (Boiler Rooms, etc)</li>
                    <li>1-2 sales calls at meeting 2-3 in the pipeline for Towns Protocol development</li>
                    <li>Contributor get S-Tier reservations (exclusive merch drop)</li>
                    <li>Photography + teasers created for S-Tier drop to general public</li>
                    <li>Minimum 175 Contributors in chat + 250 Knead Members</li>
                  </ul>
                </div>

                {/* Month 5 */}
                <div>
                  <h4 className="font-adonis text-2xl mb-4 text-black">Month 5</h4>
                  <ul className="font-georgia-pro text-base space-y-2 list-disc pl-6 text-black">
                    <li>Continuing weekly events + activations</li>
                    <li>First IRL event complete (Blvck Svm michelinman dinner)</li>
                    <li>1 quality sales lead for Towns Protocol development</li>
                    <li>S-Tier line of merch mailed to Contributors + redemption portal established</li>
                    <li>Larger $TOWNS grant unlocked to ramp up all activations (Merch, Digital/IRL events, etc)</li>
                  </ul>
                </div>

              </div>
            </div>

            {/* Final Benchmarks */}
            <div>
              <h3 className="font-adonis text-3xl md:text-4xl mb-6 text-black">Final Benchmarks:</h3>
              <ul className="font-georgia-pro text-xl space-y-2 list-disc pl-6 text-black">
                <li>175+ Contributors</li>
                <li>250+ Members</li>
                <li>1 qualified enterprise sales lead</li>
                <li>3-5 more sales leads in the pipeline</li>
              </ul>
            </div>

            {/* Other Role Considerations */}
            <div>
              <h3 className="font-adonis text-3xl md:text-4xl mb-6 text-black">Other Role Considerations:</h3>
              <p className="font-georgia-pro text-lg mb-6 text-black">
                These are roles that are reasonable expectations to help push Towns + Knead. Not an immediate need, but good to forecast:
              </p>
              <ul className="font-georgia-pro text-lg space-y-2 list-disc pl-6 text-black">
                <li>Part-time blockchain engineer: $5,000/month</li>
                <li>Visual team (photography/illustration/digital design): $12,000/month</li>
                <li>Part-time producer: $3,500/month</li>
              </ul>
            </div>

          </div>
        </div>
      </Slide>

      {/* ── Screen 9: The Big Deal ──────────────────────────────────────────── */}
      <Slide id={8} {...slideProps}>
        <div className="max-w-4xl space-y-8">
          <motion.h2 variants={fadeIn} className="text-5xl md:text-7xl font-adonis mb-12 text-black">
            The Big Deal
          </motion.h2>
          {[
            "Knead + Towns can show the creative industry that the future of media is a /chat.",
            "Especially with the rise of AI, more brands will be taking a serious look at owning the means of distribution for their media.",
            "We're returning to an era where a brand can own the full experience on their website. You know, a time where the internet can be fun again.",
            "That's why, together, we can build a place for those memories to exist, starting with /chat.",
          ].map((para, i) => (
            <motion.p key={i} variants={fadeIn} className="font-georgia-pro text-xl md:text-2xl text-black leading-relaxed">
              {para}
            </motion.p>
          ))}
        </div>
      </Slide>

      {/* ── Screen 10: Closing ─────────────────────────────────────────────── */}
      <Slide id={9} {...slideProps}>
        <div className="text-center">
          <motion.h2 variants={fadeIn} className="font-adonis text-5xl md:text-7xl text-black mb-8">
            Thanks for reading.
          </motion.h2>
          <motion.p variants={fadeIn} className="font-georgia-pro text-xl md:text-2xl text-black italic">
            <a 
              href="https://kneadmag.com/chat" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Check out our chat at kneadmag.com/chat
            </a>
          </motion.p>
        </div>
      </Slide>
    </div>
  )
}
