'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { EventsEmailSignup } from '@/components/chat/EventsEmailSignup';
import { useActiveAccount } from 'thirdweb/react';
import { useMembership } from '@/components/membership-provider';
import { useToast } from '@/hooks/use-toast';
import { memberFetch } from '@/lib/auth/member-fetch';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export function WelcomeModal({ isOpen, onClose, userId }: WelcomeModalProps) {
  const account = useActiveAccount();
  const { membershipType } = useMembership();
  const { toast } = useToast();
  const isPremium = membershipType === 'premium';

  const [alias, setAlias] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAlias = async () => {
    if (!account?.address || !alias.trim()) return;
    setIsSaving(true);
    try {
      await memberFetch('/api/contributor/update-profile', account, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userAddress: account.address,
          alias: alias.trim(),
        }),
      });
      window.dispatchEvent(new CustomEvent('knead:profile-updated', {
        detail: { address: account.address.toLowerCase(), alias: alias.trim() },
      }));
      toast({ title: 'Alias saved!', description: 'Your display name has been set.' });
    } catch {
      toast({ title: 'Could not save alias', description: 'You can set it later in Profile Settings.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = async () => {
    if (isPremium && alias.trim()) {
      await handleSaveAlias();
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between z-10 animate-fade-in-up">
              <h1 className="font-adonis text-2xl">Welcome to the chat.</h1>
              <button
                onClick={handleClose}
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
                  Our chat features live interviews, DJ sets, and other events.
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
                      <strong>Free</strong> members can watch events in the chat for one hour per month.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 shrink-0">•</span>
                    <span>
                      <strong>Knead Monthly</strong> members can watch unlimitedly + participate during events, earning tips. Can also submit Demeter proposals and earn other rewards.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 shrink-0">•</span>
                    <span>
                      <strong>Contributors</strong> are special guests or earned members. They have full chat privileges, including DMs, and are allocated a weekly allowance to tip Knead Monthly members, earning 20% cash back. Can vote on Demeter proposals and gift rewards.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Alias prompt for Knead Monthly members */}
              {isPremium && (
                <div className="animate-fade-in-up-delay-3 border border-gray-200 rounded-xl p-5 space-y-3">
                  <p className="font-adonis text-lg text-gray-900">Set your display name</p>
                  <p className="font-georgia-pro text-sm text-gray-500">
                    As a Knead Monthly member you can set a chat alias. This is optional — you can always update it later in Profile Settings.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder={account ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : 'Your name'}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-georgia-pro text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      maxLength={50}
                      disabled={isSaving}
                    />
                    <button
                      onClick={handleSaveAlias}
                      disabled={!alias.trim() || isSaving}
                      className="px-4 py-2.5 bg-black text-white rounded-lg font-georgia-pro text-sm hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              <div className="animate-fade-in-up-delay-3 space-y-4">
                <hr className="border-gray-200" />
                <p className="font-georgia-pro text-lg text-gray-800 leading-relaxed">
                  We designed the chat to be an intimate home for rewarding our community with meaningful
                  experiences that can be thoughtful, educational, entertaining, or even just a way to pass the time.
                </p>
                <p className="font-georgia-pro text-lg text-gray-800 leading-relaxed pb-2 mt-4">
                  ...you know, a place where the internet can be fun again.
                </p>
              </div>

              <div className="animate-fade-in-up-delay-4 border-t border-gray-200 pt-6 mt-6">
                <h3 className="font-adonis text-xl mb-3">Stay Updated</h3>
                <p className="font-georgia-pro text-sm text-gray-600 mb-4">
                  Sign up for our mailing list to keep up with events:
                </p>
                <EventsEmailSignup />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
