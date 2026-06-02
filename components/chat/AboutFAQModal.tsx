'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Instagram, Twitter } from 'lucide-react';
import { FAQDropdown } from '@/components/faq-dropdown';

interface AboutFAQModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutFAQModal({ isOpen, onClose }: AboutFAQModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-gray-700" />
                <h2 className="text-2xl font-adonis">About & FAQ</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 80px)' }}>

              {/* About Section */}
              <section className="mb-8">
                <h3 className="text-2xl font-adonis mb-4">About</h3>
                <div className="space-y-4 font-georgia-pro text-gray-700 leading-relaxed">
                  <p>
                    Welcome to our chat– a space to share ideas, stories, random musings, and
                    connect with like-minded creatives across an array of disciplines.
                  </p>
                  <p>
                    Every week we'll host events including live interviews, DJ sets, open discussions, product reviews, and more.
                  </p>
                  <p>
                    The chat is designed to encourage thoughtful conversations using a gamified
                    system with rewards. As members elevate their status, they'll unlock more permissions in the chat.
                  </p>
                </div>
              </section>

              {/* Tiers Section */}
              <section className="mb-8">
                <h3 className="text-2xl font-adonis mb-4">Tiers</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-gray-200 rounded-xl p-4">
                    <h4 className="font-adonis text-lg mb-2">Free</h4>
                    <ul className="font-georgia-pro text-gray-700 text-sm leading-relaxed space-y-1 list-disc list-outside pl-4">
                      <li>Allowed to read messages + watch chat events for 1 hour per month.</li>
                    </ul>
                  </div>

                  <div className="border border-gray-200 rounded-xl p-4">
                    <h4 className="font-adonis text-lg mb-2">Knead Monthly</h4>
                    <ul className="font-georgia-pro text-gray-700 text-sm leading-relaxed space-y-1 list-disc list-outside pl-4">
                      <li>Unlimited viewing/reacting.</li>
                      <li>Custom alias.</li>
                      <li>Participate during live events.</li>
                      <li>Submit Demeter proposals.</li>
                      <li>Earn rewards.</li>
                    </ul>
                  </div>

                  <div className="border border-gray-200 rounded-xl p-4">
                    <h4 className="font-adonis text-lg mb-2">Contributors</h4>
                    <ul className="font-georgia-pro text-gray-700 text-sm leading-relaxed space-y-1 list-disc list-outside pl-4">
                      <li>Full access including anytime messaging.</li>
                      <li>DMs + Video Chat with other Contributors.</li>
                      <li>Custom alias, avatar, and bio.</li>
                      <li>20% cashback on tips.</li>
                      <li>Vote on Demeter proposals.</li>
                      <li>Give gifts to Knead Monthly members.</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* FAQ Section */}
              <section>
                <h3 className="text-2xl font-adonis mb-4 text-center">Frequently Asked Questions</h3>
                <div className="space-y-2">
                  <FAQDropdown
                    question="What's the Treasury Contract?"
                    answer="The Treasury Contract is where the chat's tipping system rules are written. If you'd like to donate, the address is: 0xf94ee5efd046486ad3c2554bad48c82dfb17ca12"
                  />

                  <FAQDropdown
                    question="What's Demeter?"
                    answer="Demeter is an agent for managing creator proposals and giving rewards."
                  />

                  <FAQDropdown
                    question="How do you establish the amount of tips and rewards for the Treasury and Demeter?"
                    answer="We look at the amount of events we're forecasting against the total amount of USDC in our treasury. This includes how many Contributors and Knead Monthly members are currently active."
                  />

                  <FAQDropdown
                    question="What does 'Export Private Key' mean?"
                    answer="When anyone signs up for Knead, we create a digital wallet on the backend that automatically is minted a free-tier membership. You own this wallet and are free to do with it as you please, Knead does not 'own' your account- you do. The main identifier of your ownership is your private key, which enables you to send funds, port your wallet elsewhere, etc. IMPORTANT: NEVER SHARE YOUR PRIVATE KEY."
                  />

                  <FAQDropdown
                    question="What should I do with the USDC I earn? Where should I send it?"
                    answer="USDC is a stablecoin available on Coinbase, Binance, PayPal, CashApp, Venmo, and other popular platforms. We highly encourage creating an account with a company that accepts USDC to transfer your Knead chat earnings to."
                  />

                  <FAQDropdown
                    question="How do I become a Contributor? Do I get more USDC if I 'graduate' to one?"
                    answer="The graduation threshold for Contributor status is determined by the Treasury balance. While it varies case-by-case, we generally define Contributors as individuals who've been active in the chat for a couple of months and participating in events. Those that graduated to become Contributors are allocated a larger weekly allowance than those who are appointed by Knead."
                  />

                  <FAQDropdown
                    question="Why's it saying I can't participate or DM?"
                    answer="Knead Monthly members are only able to participate in the chat during events (live interviews, portfolio reviews, open chat, etc). DMs are only open to those who've earned Contributor status."
                  />

                  <FAQDropdown
                    question="How do I get support?"
                    answer="For support, email help@kneadmag.com"
                  />
                </div>
              </section>

              {/* Connect Section */}
              <section className="mt-8 pt-6 border-t border-gray-200 text-center">
                <h3 className="text-xl font-adonis mb-6">Connect With Knead</h3>
                <div className="flex justify-center space-x-12">
                  <a
                    href="https://www.instagram.com/knead.mag/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-black transition-colors"
                    aria-label="Instagram"
                  >
                    <Instagram size={36} />
                  </a>
                  <a
                    href="https://x.com/kneadmag"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-black transition-colors"
                    aria-label="X (Twitter)"
                  >
                    <Twitter size={36} />
                  </a>
                  <a
                    href="https://warpcast.com/knead"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-black transition-colors"
                    aria-label="Farcaster"
                  >
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="currentColor">
                      <g transform="translate(4, 6)">
                        <rect x="2" y="4" width="3" height="16" />
                        <rect x="0" y="18" width="7" height="2" />
                        <rect x="1" y="20" width="5" height="2" />
                        <rect x="0.5" y="22" width="6" height="2" />
                        <rect x="23" y="4" width="3" height="16" />
                        <rect x="21" y="18" width="7" height="2" />
                        <rect x="22" y="20" width="5" height="2" />
                        <rect x="21.5" y="22" width="6" height="2" />
                        <rect x="2" y="2" width="24" height="2" />
                        <rect x="0" y="0" width="28" height="2" />
                        <path d="M 8 20 Q 14 8 20 20" stroke="none" fill="white" />
                        <ellipse cx="14" cy="16" rx="6" ry="8" fill="white" />
                      </g>
                    </svg>
                  </a>
                  <a
                    href="https://zora.co/@knead"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-black transition-colors"
                    aria-label="Zora"
                  >
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="currentColor">
                      <defs>
                        <radialGradient id="zoraGradient" cx="0.3" cy="0.3" r="0.8">
                          <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                          <stop offset="50%" stopColor="currentColor" stopOpacity="0.7" />
                          <stop offset="100%" stopColor="currentColor" stopOpacity="0.5" />
                        </radialGradient>
                      </defs>
                      <circle cx="18" cy="18" r="16" fill="url(#zoraGradient)" />
                      <ellipse cx="14" cy="14" rx="4" ry="6" fill="currentColor" opacity="0.3" />
                    </svg>
                  </a>
                </div>
              </section>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
