'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen } from 'lucide-react';
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
                <h3 className="text-2xl font-adonis mb-4">About Knead Chat</h3>
                <div className="space-y-4 font-georgia-pro text-gray-700 leading-relaxed">
                  <p>
                    Welcome to Knead's community chat – a space where creative minds connect, 
                    share ideas, and build relationships around art, music, food, tech, and culture.
                  </p>
                  <p>
                    Our chat is powered by blockchain technology and $TOWNS tokens, creating 
                    a community where engagement is rewarded and quality contributions are valued.
                  </p>
                </div>
              </section>

              {/* Membership Tiers Section */}
              <section className="mb-8">
                <h3 className="text-2xl font-adonis mb-4">Membership Tiers</h3>
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-xl p-4">
                    <h4 className="font-adonis text-lg mb-2">🆓 Free Members</h4>
                    <p className="font-georgia-pro text-gray-700 text-sm leading-relaxed">
                      Browse and read messages for 1 hour per month. Perfect for discovering 
                      what Knead is all about before committing.
                    </p>
                  </div>

                  <div className="border border-gray-200 rounded-xl p-4">
                    <h4 className="font-adonis text-lg mb-2">📅 Knead Monthly (Participants)</h4>
                    <p className="font-georgia-pro text-gray-700 text-sm leading-relaxed">
                      Unlimited viewing access and the ability to participate during live events. 
                      Join discussions when events are happening and connect with the community.
                    </p>
                  </div>

                  <div className="border border-gray-200 rounded-xl p-4">
                    <h4 className="font-adonis text-lg mb-2">✨ Contributors</h4>
                    <p className="font-georgia-pro text-gray-700 text-sm leading-relaxed">
                      Full access including anytime messaging, direct messages with other contributors, 
                      custom profiles with avatars and aliases, and the ability to tip other members 
                      with $TOWNS tokens. Contributors are the core community members who keep 
                      conversations flowing.
                    </p>
                  </div>
                </div>
              </section>

              {/* FAQ Section */}
              <section>
                <h3 className="text-2xl font-adonis mb-4">Frequently Asked Questions</h3>
                <div className="space-y-2">
                  <FAQDropdown
                    question="What are $TOWNS tokens?"
                    answer="$TOWNS is our community token built on Base (Ethereum L2). You can earn $TOWNS by receiving tips from other contributors when you share valuable messages. Tokens can be used to tip others, participate in events, and more."
                  />

                  <FAQDropdown
                    question="How does tipping work?"
                    answer="Contributors can tip any message by clicking the bread icon next to it. Each tip awards $TOWNS tokens to the message sender. Tipping is a way to show appreciation for valuable contributions and helps build a quality-focused community."
                  />

                  <FAQDropdown
                    question="What types of events do you host?"
                    answer="Knead hosts various events including live video discussions, essay releases, and community gatherings. Check the Events Calendar (accessible from the menu) to see upcoming events and RSVP. Knead Monthly members can participate during events."
                  />

                  <FAQDropdown
                    question="How do I become a Contributor?"
                    answer="Contributors hold a special Contributor NFT. You can become a contributor by purchasing the NFT through our join page. Contributors get full chat access, DMs, custom profiles, and tipping abilities."
                  />

                  <FAQDropdown
                    question="Can I customize my profile?"
                    answer="Yes! Contributors can set a custom alias and upload an avatar image. Click the settings icon in the wallet dropdown to customize your profile. Your profile will be visible to all chat members."
                  />

                  <FAQDropdown
                    question="How do Direct Messages work?"
                    answer="Direct Messages (DMs) are available exclusively to Contributors. Click the paper plane icon in the top right to access your DMs. You can message other contributors privately, share files, and build deeper connections."
                  />

                  <FAQDropdown
                    question="What is the Treasury?"
                    answer="The Treasury is the smart contract that holds and distributes $TOWNS tokens for rewards and events. You can view the treasury balance in the menu and check its activity on Basescan."
                  />

                  <FAQDropdown
                    question="How do I get support?"
                    answer="For support, reach out to us on Instagram @knead.mag, Twitter @kneadmag, or through our other social channels. Contributors can also ask questions directly in the chat."
                  />
                </div>
              </section>

              {/* Connect Section */}
              <section className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-xl font-adonis mb-3">Connect with Knead</h3>
                <p className="font-georgia-pro text-gray-700 text-sm mb-4">
                  Follow us on social media for updates, announcements, and creative inspiration:
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://www.instagram.com/knead.mag/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-georgia-pro transition-colors"
                  >
                    Instagram
                  </a>
                  <a
                    href="https://x.com/kneadmag"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-georgia-pro transition-colors"
                  >
                    X (Twitter)
                  </a>
                  <a
                    href="https://warpcast.com/knead"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-georgia-pro transition-colors"
                  >
                    Farcaster
                  </a>
                  <a
                    href="https://zora.co/@knead"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-georgia-pro transition-colors"
                  >
                    Zora
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
