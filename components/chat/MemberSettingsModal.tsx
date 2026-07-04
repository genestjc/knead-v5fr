'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, User } from 'lucide-react';
import { useActiveAccount } from 'thirdweb/react';
import { useToast } from '@/hooks/use-toast';
import { walletFetch } from '@/lib/auth/wallet-fetch';

interface MemberSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
  currentAlias?: string;
  currentBio?: string;
  userId: string;
  onSaved?: (alias: string | null, bio: string | null) => void;
}

export function MemberSettingsModal({
  isOpen,
  onClose,
  userAddress,
  currentAlias,
  currentBio,
  userId,
  onSaved,
}: MemberSettingsModalProps) {
  const account = useActiveAccount();
  const [alias, setAlias] = useState(currentAlias || '');
  const [bio, setBio] = useState(currentBio || '');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setAlias(currentAlias || '');
      setBio(currentBio || '');
    }
  }, [isOpen, currentAlias, currentBio]);

  const handleSave = async () => {
    if (!account) {
      toast({ title: 'Wallet not connected', description: 'Reconnect your wallet and try again.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const finalAlias = alias.trim() || null;
      const finalBio = bio.trim() || null;

      const response = await walletFetch('/api/contributor/update-profile', account, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userAddress,
          alias: finalAlias,
          bio: finalBio,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to update profile');

      onSaved?.(finalAlias, finalBio);

      window.dispatchEvent(new CustomEvent('knead:profile-updated', {
        detail: { address: userAddress.toLowerCase(), alias: finalAlias, bio: finalBio },
      }));

      toast({ title: 'Profile updated!', description: 'Your display name has been saved.' });
      setTimeout(() => onClose(), 800);
    } catch (error) {
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
          onClick={onClose}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <User className="w-6 h-6 text-gray-700" />
                <h2 className="font-adonis text-2xl">Profile Settings</h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block font-adonis text-sm text-gray-700 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder={`${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-georgia-pro text-sm"
                disabled={isSaving}
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">Shown instead of your wallet address in chat</p>
            </div>

            <div className="mb-6">
              <label className="block font-adonis text-sm text-gray-700 mb-2">
                Short Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the community a little about yourself..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-georgia-pro text-sm resize-none"
                disabled={isSaving}
                maxLength={160}
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1 flex justify-between">
                <span>Optional • Visible to all users</span>
                <span>{bio.length}/160</span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-full font-georgia-pro text-sm hover:bg-gray-200 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-black text-white rounded-full font-georgia-pro text-sm hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? 'Saving...' : (<><Check className="w-4 h-4" />Save Changes</>)}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
