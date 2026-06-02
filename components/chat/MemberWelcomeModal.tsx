'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MemberWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
  userId?: string;
}

export function MemberWelcomeModal({ isOpen, onClose, userAddress, userId }: MemberWelcomeModalProps) {
  const { toast } = useToast();
  const [alias, setAlias] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!alias.trim()) { onClose(); return; }
    setIsSaving(true);
    try {
      await fetch('/api/contributor/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userAddress, alias: alias.trim() }),
      });
      window.dispatchEvent(new CustomEvent('knead:profile-updated', {
        detail: { address: userAddress.toLowerCase(), alias: alias.trim() },
      }));
      toast({ title: 'Alias saved!', description: 'Your display name has been set.' });
    } catch {
      toast({ title: 'Could not save alias', description: 'You can set it later in Profile Settings.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
      onClose();
    }
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
          onClick={onClose}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-5 flex items-start justify-between z-10 gap-4 animate-fade-in-up">
              <h1 className="font-adonis text-2xl leading-snug">
                Welcome to Knead Monthly.
              </h1>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto px-8 py-6 space-y-5" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              <p className="font-georgia-pro text-lg text-gray-800 leading-relaxed animate-fade-in-up-delay">
                Thank you for subscribing — we're glad to have you.
              </p>

              <div className="animate-fade-in-up-delay-2 space-y-3 font-georgia-pro text-base text-gray-700 leading-relaxed">
                <p>As a Knead Monthly member you can:</p>
                <ul className="space-y-2 list-disc list-inside">
                  <li>Watch all events without any time limit.</li>
                  <li>Participate and comment during live events.</li>
                  <li>Receive tips from Contributors in the chat.</li>
                  <li>Submit Demeter proposals once per week.</li>
                  <li>Receive gifts from Contributors in the chat.</li>
                  <li>Set a display name (alias) that appears in the chat.</li>
                </ul>
              </div>

              {/* Alias input */}
              <div className="animate-fade-in-up-delay-3 border border-gray-200 rounded-xl p-5 space-y-3">
                <p className="font-adonis text-base text-gray-900">Set your display name</p>
                <p className="font-georgia-pro text-sm text-gray-500">
                  Choose an alias to appear in the chat instead of your wallet address. You can always update this later in Profile Settings.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder={`${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-georgia-pro text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    maxLength={50}
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="animate-fade-in-up-delay-4 flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-full font-georgia-pro text-sm hover:bg-gray-200 transition disabled:opacity-50"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 bg-black text-white rounded-full font-georgia-pro text-sm hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {isSaving ? 'Saving…' : 'Save & Enter'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
