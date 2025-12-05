"use client"

import type React from "react"
import { useState, useEffect, useRef, type TouchEvent } from "react"
import Image from "next/image"
import { Header } from "@/components/header"
import { motion } from "framer-motion"

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: "easeOut",
    },
  },
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3,
    },
  },
}

// Password protection component
const PasswordProtection = ({ onSuccess }: { onSuccess: () => void }) => {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    setTimeout(() => {
      if (password === "towns26") {
        onSuccess()
      } else {
        setError("Incorrect password.  Please try again.")
        setPassword("")
      }
      setIsLoading(false)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-3xl md:text-4xl font-adonis mb-4"
          >
            Knead Magazine
          </motion. h1>
          <motion. p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-lg text-gray-300 font-georgia-pro"
          >
            Towns Chat - Private Pitch Deck
          </motion.p>
        </div>

        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Enter Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
              placeholder="Password"
              required
              disabled={isLoading}
            />
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-sm mt-2"
              >
                {error}
              </motion.p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Verifying..." : "Access Pitch Deck"}
          </button>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-gray-400 font-georgia-pro">Towns Chat - Community for High-Level Conversation</p>
        </motion. div>
      </motion.div>
    </div>
  )
}

export default function TownsIntroChatPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const [animateSlide, setAnimateSlide] = useState(0)

  // Check if user is already authenticated
  useEffect(() => {
    const authenticated = sessionStorage.getItem("towns-intro-chat26-auth")
    if (authenticated === "true") {
      setIsAuthenticated(true)
    }
  }, [])

  const handlePasswordSuccess = () => {
    sessionStorage.setItem("towns-intro-chat26-auth", "true")
    setIsAuthenticated(true)
  }

  // Scroll to slide function
  const scrollToSlide = (index: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setCurrentSlide(index)
    setAnimateSlide(index)
    slideRefs.current[index]?. scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }

  // Slide component
  const Slide = ({ id, children }: { id: number; children: React.ReactNode }) => {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries. forEach((entry) => {
            if (entry.isIntersecting) {
              setCurrentSlide(id)
              setIsVisible(true)
              setAnimateSlide(id)
            }
          })
        },
        { threshold: 0. 5 },
      )

      const element = slideRefs.current[id]
      if (element) {
        observer.observe(element)
      }

      return () => {
        if (element) {
          observer.unobserve(element)
        }
      }
    }, [id])

    return (
      <div
        ref={(el) => {
          slideRefs.current[id] = el
        }}
        className="min-h-screen flex items-center justify-center py-20 px-4 md:px-8"
      >
        <motion. div
          initial="hidden"
          animate={isVisible ? "visible" : "hidden"}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: 0. 8 } },
          }}
          className="w-full max-w-5xl"
        >
          {children}
        </motion.div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <PasswordProtection onSuccess={handlePasswordSuccess} />
  }

  return (
    <div className="bg-black text-white overflow-x-hidden">
      <Header />

      {/* Logout button */}
      <button
        onClick={() => {
          sessionStorage.removeItem("towns-intro-chat26-auth")
          setIsAuthenticated(false)
        }}
        className="fixed top-4 right-4 z-50 px-4 py-2 bg-white/10 backdrop-blur-sm text-white text-sm rounded-lg hover:bg-white/20 transition-colors"
      >
        Logout
      </button>

      {/* Navigation dots */}
      <div className="fixed right-8 top-1/2 transform -translate-y-1/2 z-50 hidden md:block">
        <div className="flex flex-col space-y-4">
          {Array.from({ length: 11 }). map((_, i) => (
            <button
              key={i}
              onClick={(e) => scrollToSlide(i, e)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                currentSlide === i ? "bg-white scale-125" : "bg-gray-500 hover:bg-gray-300"
              }`}
              aria-label={`Go to slide ${i + 1}`}
              type="button"
            />
          ))}
        </div>
      </div>

      {/* Slide 0 - Title */}
      <div className="relative min-h-screen">
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-purple-900/20 via-black to-black" />

        <Slide id={0}>
          <div className="flex flex-col items-center justify-center text-center space-y-8 relative z-10">
            <motion.h1
              variants={fadeIn}
              className="text-5xl md:text-7xl lg:text-8xl font-adonis tracking-widest"
            >
              Towns
            </motion.h1>
            <motion.h2 variants={fadeIn} className="text-2xl md:text-3xl font-georgia-pro tracking-wide text-gray-300">
              Community for High-Level Conversation
            </motion.h2>
            <motion.div variants={fadeIn} className="pt-8">
              <p className="text-xl md:text-2xl font-georgia-pro">Presented by</p>
              <p className="text-3xl md:text-4xl font-adonis mt-2 tracking-wider">Knead Magazine</p>
            </motion. div>
            <motion.div variants={fadeIn} className="pt-12">
              <p className="text-lg italic text-gray-400 font-georgia-pro">Scroll down to explore</p>
              <div className="animate-bounce mt-4 flex justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3. org/2000/svg">
                  <path
                    d="M12 5V19M12 19L5 12M12 19L19 12"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </motion. div>
          </div>
        </Slide>
      </div>

      {/* Slide 1 - Vision */}
      <Slide id={1}>
        <div className="space-y-8">
          <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis text-center">
            The Vision
          </motion.h2>
          <motion.div variants={fadeIn} className="max-w-3xl mx-auto space-y-6">
            <p className="text-xl md:text-2xl font-georgia-pro text-center">
              Towns is a community for high-level conversation and engagement, incentivizing certain conversational behaviors between high-level special guests and Knead Monthly members.
            </p>
            <p className="text-lg md:text-xl font-georgia-pro text-center text-gray-300">
              It lives natively on Knead's website at <span className="font-bold">kneadmag.com/chat</span>
            </p>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 2 - Events */}
      <Slide id={2}>
        <div className="space-y-8">
          <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis text-center">
            Events in the Chat
          </motion.h2>
          <motion.div variants={fadeIn} className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-xl border border-white/10">
              <h3 className="text-2xl font-adonis mb-3">Live Video/Audio Interviews</h3>
              <p className="text-lg font-georgia-pro text-gray-300">Direct conversations with special guests in real-time</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-xl border border-white/10">
              <h3 className="text-2xl font-adonis mb-3">Open Hours</h3>
              <p className="text-lg font-georgia-pro text-gray-300">Extended access for deeper discussions and Q&A</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-xl border border-white/10">
              <h3 className="text-2xl font-adonis mb-3">Portfolio Reviews</h3>
              <p className="text-lg font-georgia-pro text-gray-300">Curated feedback on creative work from industry experts</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-xl border border-white/10">
              <h3 className="text-2xl font-adonis mb-3">& More</h3>
              <p className="text-lg font-georgia-pro text-gray-300">Custom events and experiences</p>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 3 - Multipliers */}
      <Slide id={3}>
        <div className="space-y-8">
          <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis text-center">
            Multipliers & Rewards
          </motion.h2>
          <motion.div variants={fadeIn} className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-xl border border-white/10">
              <h3 className="text-xl font-adonis mb-4">In-Thread Debates</h3>
              <p className="text-lg font-georgia-pro mb-4">Comments that start an in-thread debate are rewarded for <span className="font-bold">every contribution</span> to that conversation.</p>
              <p className="text-sm text-gray-400 italic">Creates incentive for substantive back-and-forth dialogue</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
                <h3 className="text-lg font-adonis mb-3">Insightful Comments</h3>
                <p className="text-base font-georgia-pro text-gray-300">Tagged and highlighted for community recognition</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
                <h3 className="text-lg font-adonis mb-3">Good Questions</h3>
                <p className="text-base font-georgia-pro text-gray-300">Rewarded for sparking valuable discussions</p>
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 4 - Roles: Participants */}
      <Slide id={4}>
        <div className="space-y-8">
          <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis text-center">
            Two Roles
          </motion.h2>
          <motion.div variants={fadeIn} className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-3xl font-adonis">Participants</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-georgia-pro font-bold mb-2">Who</p>
                  <p className="text-lg font-georgia-pro text-gray-300">Knead Monthly members</p>
                </div>
                <div>
                  <p className="text-lg font-georgia-pro font-bold mb-2">Earn $TOWNS by</p>
                  <ul className="space-y-2 text-lg font-georgia-pro text-gray-300">
                    <li>✓ Asking good questions</li>
                    <li>✓ Making insightful comments</li>
                    <li>✓ Submitting quality work</li>
                  </ul>
                </div>
                <div>
                  <p className="text-lg font-georgia-pro font-bold mb-2">Goal</p>
                  <p className="text-lg font-georgia-pro text-gray-300">Active participation in community events</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-3xl font-adonis">Contributors</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-georgia-pro font-bold mb-2">Who</p>
                  <p className="text-lg font-georgia-pro text-gray-300">Influencers, special guests, or high-earning members</p>
                </div>
                <div>
                  <p className="text-lg font-georgia-pro font-bold mb-2">Earn 25% for</p>
                  <ul className="space-y-2 text-lg font-georgia-pro text-gray-300">
                    <li>✓ Engaging with Participants</li>
                    <li>✓ Commenting on posts</li>
                    <li>✓ Reacting to contributions</li>
                  </ul>
                </div>
                <div>
                  <p className="text-lg font-georgia-pro font-bold mb-2">Benefit</p>
                  <p className="text-lg font-georgia-pro text-gray-300">Passive feedback loop for thought leadership</p>
                </div>
              </div>
            </div>
          </motion. div>
        </div>
      </Slide>

      {/* Slide 5 - Contributor Budget */}
      <Slide id={5}>
        <div className="space-y-8">
          <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis text-center">
            Contributor Economics
          </motion.h2>
          <motion.div variants={fadeIn} className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-xl border border-white/10">
              <h3 className="text-2xl font-adonis mb-4">Weekly Budget Model</h3>
              <p className="text-lg font-georgia-pro mb-6">
                Contributors are allocated a budget of $TOWNS every week to distribute among Participants.
              </p>
              <div className="space-y-3 text-lg font-georgia-pro">
                <p className="text-gray-300">
                  • For every point awarded: Contributors keep <span className="font-bold">25%</span>
                </p>
                <p className="text-gray-300">
                  • Creates <span className="font-bold">passive income</span> for active participation
                </p>
                <p className="text-gray-300">
                  • Budget <span className="font-bold">resets weekly</span> for consistent engagement
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 6 - Backend Tech */}
      <Slide id={6}>
        <div className="space-y-8">
          <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis text-center">
            Backend Infrastructure
          </motion.h2>
          <motion.div variants={fadeIn} className="max-w-4xl mx-auto space-y-6">
            <p className="text-xl font-georgia-pro text-center text-gray-300 mb-8">
              Easy onboarding for non-crypto users with secure, non-custodial wallet integration
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
                <h3 className="text-xl font-adonis mb-3">Payments</h3>
                <p className="text-lg font-georgia-pro text-gray-300">Stripe to mint into non-custodial wallet via ThirdWeb</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
                <h3 className="text-xl font-adonis mb-3">Chat Settings</h3>
                <p className="text-lg font-georgia-pro text-gray-300">Transfer funds & access private keys (hidden by default)</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
                <h3 className="text-xl font-adonis mb-3">Admin Dashboard</h3>
                <p className="text-lg font-georgia-pro text-gray-300">Manual Knead Memberships & Contributor tags</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
                <h3 className="text-xl font-adonis mb-3">Getting Started</h3>
                <p className="text-lg font-georgia-pro text-gray-300">Submit wallet address on homepage to begin</p>
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 7 - Compliance */}
      <Slide id={7}>
        <div className="space-y-8">
          <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis text-center">
            Financial Compliance
          </motion.h2>
          <motion.div variants={fadeIn} className="max-w-3xl mx-auto">
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-xl border border-white/10 space-y-6">
              <div>
                <h3 className="text-2xl font-adonis mb-4">Non-Custodial Wallet Integration</h3>
                <p className="text-lg font-georgia-pro text-gray-300 mb-4">
                  ThirdWeb's solution enables users to access their private keys while maintaining regulatory compliance.
                </p>
              </div>

              <div className="border-t border-white/10 pt-6">
                <h3 className="text-2xl font-adonis mb-4">Instantaneous Rewards</h3>
                <p className="text-lg font-georgia-pro text-gray-300">
                  $TOWNS rewards allocated directly into user wallets in real-time
                </p>
              </div>

              <div className="border-t border-white/10 pt-6">
                <h3 className="text-2xl font-adonis mb-4">Transparent Transactions</h3>
                <p className="text-lg font-georgia-pro text-gray-300">
                  All transactions auditable and verifiable on Base blockchain
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 8 - Framework */}
      <Slide id={8}>
        <div className="space-y-8">
          <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis text-center">
            Our Framework
          </motion.h2>
          <motion.div variants={fadeIn} className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-2 gap-6">
            <div className="bg-blue-500/10 backdrop-blur-sm p-6 rounded-xl border border-blue-500/30">
              <h3 className="text-xl font-adonis mb-2">Daily</h3>
              <p className="text-lg font-georgia-pro text-gray-300">Live interviews & conversations</p>
            </div>
            <div className="bg-purple-500/10 backdrop-blur-sm p-6 rounded-xl border border-purple-500/30">
              <h3 className="text-xl font-adonis mb-2">Towns</h3>
              <p className="text-lg font-georgia-pro text-gray-300">Messaging & rewards system</p>
            </div>
            <div className="bg-green-500/10 backdrop-blur-sm p-6 rounded-xl border border-green-500/30">
              <h3 className="text-xl font-adonis mb-2">OpenAI</h3>
              <p className="text-lg font-georgia-pro text-gray-300">Content moderation</p>
            </div>
            <div className="bg-orange-500/10 backdrop-blur-sm p-6 rounded-xl border border-orange-500/30">
              <h3 className="text-xl font-adonis mb-2">ThirdWeb</h3>
              <p className="text-lg font-georgia-pro text-gray-300">Non-custodial wallets & minting</p>
            </div>
          </motion.div>

          <motion.div variants={fadeIn} className="max-w-2xl mx-auto text-center pt-8">
            <p className="text-lg font-georgia-pro text-gray-300">
              Memberships minted on <span className="font-bold">Base blockchain</span>, including Knead Monthly and Contributor roles
            </p>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 9 - Tokenomics Summary */}
      <Slide id={9}>
        <div className="space-y-8">
          <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-adonis text-center">
            Tokenomics TLDR
          </motion.h2>
          <motion.div variants={fadeIn} className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-xl border border-white/10">
              <h3 className="text-2xl font-adonis mb-4">The System in 4 Points</h3>
              <ul className="space-y-4 text-lg font-georgia-pro text-gray-300">
                <li className="flex items-start">
                  <span className="font-bold mr-3">1. </span>
                  <span><span className="font-bold">Participants</span> earn $TOWNS through quality engagement and participation in community events</span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-3">2.</span>
                  <span><span className="font-bold">Contributors</span> receive weekly budgets to reward Participants while keeping 25% of all awards they give</span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-3">3.</span>
                  <span><span className="font-bold">Multipliers</span> reward quality contributions through tags, reacts, and debate participation across events</span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-3">4.</span>
                  <span><span className="font-bold">Non-custodial</span> wallets enable transparent, compliant token distribution with real-time settlement</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm p-8 rounded-xl border border-white/10">
              <h3 className="text-2xl font-adonis mb-4">Result</h3>
              <p className="text-xl font-georgia-pro">
                A self-sustaining community where high-level conversation is directly incentivized, quality is automatically rewarded, and authentic engagement drives network growth.
              </p>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 10 - Thank You */}
      <Slide id={10}>
        <motion.div variants={fadeIn} className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
          <h2 className="text-5xl md:text-7xl font-adonis text-center">Ready to Join Towns?</h2>
          <p className="text-2xl font-georgia-pro text-gray-300 text-center max-w-2xl">
            Experience high-level conversation incentivized by community rewards
          </p>
          <p className="text-lg font-georgia-pro text-gray-400 text-center mt-12">
            Coming soon at <span className="font-bold">kneadmag.com/chat</span>
          </p>
        </motion.div>
      </Slide>
    </div>
  )
}
