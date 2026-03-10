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
          <div
            className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between z-10 animate-fade-in-up">
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
              <div className="animate-fade-in-up-delay space-y-4">
                <p className="font-georgia-pro text-lg text-gray-800 leading-relaxed">
                  We're delighted you're here.
                </p>
                <p className="font-georgia-pro text-lg text-gray-800 leading-relaxed">
                  Our chat features live interviews, portfolio reviews, music streams, and other events.
                </p>
                <p className="font-georgia-pro text-lg text-gray-800 leading-relaxed">
                  It's our home for conversation and creativity across an array of disciplines.
                </p>
              </div>

              <div className="animate-fade-in-up-delay-2 space-y-4">
                <h2 className="font-adonis text-2xl pt-2">How it Works</h2>

                <p className="font-georgia-pro text-lg text-gray-800 leading-relaxed">
                  Our chat has three tiers of memberships:
                </p>

                <ul className="space-y-3 font-georgia-pro text-lg text-gray-800 leading-relaxed">
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
              </div>

              <div className="animate-fade-in-up-delay-3 space-y-4">
                <hr className="border-gray-200" />

                <p className="font-georgia-pro text-lg text-gray-800 leading-relaxed">
                  We designed the chat to be an intimate home for rewarding our community with meaningful
                  experiences that can be thoughtful, fun, educational, entertaining, or even just a way
                  to pass the time.
                </p>
                <p className="font-georgia-pro text-lg text-gray-800 leading-relaxed pb-2 mt-4">
                  ...you know, a place where the internet can be fun again.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
