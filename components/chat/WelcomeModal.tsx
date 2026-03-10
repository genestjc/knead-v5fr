'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between z-10">
              <h1 className="font-adonis text-2xl">Welcome to the chat.</h1>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto px-8 py-6 space-y-6" style={{ maxHeight: 'calc(90vh - 72px)' }}>
              <p className="font-georgia-pro text-gray-800 leading-relaxed">
                We're delighted you're here.
              </p>
              <p className="font-georgia-pro text-gray-800 leading-relaxed">
                Our chat features live streams, interviews, audio events, portfolio reviews, and other events.
              </p>
              <p className="font-georgia-pro text-gray-800 leading-relaxed">
                It's our home for conversation and creativity across an array of disciplines.
              </p>

              <h2 className="font-adonis text-xl pt-2">How it Works</h2>

              <p className="font-georgia-pro text-gray-800 leading-relaxed">
                Our chat has three tiers of memberships:
              </p>

              <ul className="space-y-3 font-georgia-pro text-gray-800 leading-relaxed">
                <li className="flex gap-3">
                  <span className="mt-1 shrink-0">•</span>
                  <span>
                    <strong>Free members</strong> can watch events in the chat for one hour per month.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 shrink-0">•</span>
                  <span>
                    <strong>Knead Monthly members</strong> can watch unlimitedly + participate during events,
                    earning $TOWNS for making good discussion points on their way to Contributor status.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 shrink-0">•</span>
                  <span>
                    <strong>Contributors</strong> are special guests or earned members. They have full chat
                    privileges, including DMs, and are allocated a weekly allowance to spend from the Treasury
                    on Knead Monthly member comments. Contributors earn 20% back on the $TOWNS they spend from
                    their budget, which is on a 'use it or lose it' basis.
                  </span>
                </li>
              </ul>

              <hr className="border-gray-200" />

              <p className="font-georgia-pro text-gray-800 leading-relaxed">
                We designed the chat to be a smaller space for more intentional conversation, away from
                gimmicky content and spam. This is our home to reward our community with meaningful
                experiences that can be thoughtful, fun, educational, entertaining, or even just a way
                to pass the time.
              </p>
              <p className="font-georgia-pro text-gray-800 leading-relaxed pb-2">
                You know, a place where the internet can be fun again.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
