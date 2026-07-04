'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, User, Check } from 'lucide-react';
import { useActiveAccount } from 'thirdweb/react';
import { useToast } from '@/hooks/use-toast';
import { walletFetch } from '@/lib/auth/wallet-fetch';

interface ContributorWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
  userId: string;
  currentAlias?: string;
  currentAvatar?: string;
  currentBio?: string;
  onSaved?: (alias: string | null, avatar: string | null, bio: string | null) => void;
}

export function ContributorWelcomeModal({
  isOpen,
  onClose,
  userAddress,
  userId,
  currentAlias,
  currentAvatar,
  currentBio,
  onSaved,
}: ContributorWelcomeModalProps) {
  const account = useActiveAccount();
  const [alias, setAlias] = useState(currentAlias || '');
  const [bio, setBio] = useState(currentBio || '');
  const [email, setEmail] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(currentAvatar || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setAlias(currentAlias || '');
      setBio(currentBio || '');
      setEmail('');
      setAvatarPreview(currentAvatar || '');
      setAvatarFile(null);
    }
  }, [isOpen, currentAlias, currentAvatar, currentBio]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image under 5MB',
        variant: 'destructive',
      });
      return;
    }

    setAvatarFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    console.log('💾 ContributorWelcomeModal handleSave called', { userId, userAddress });

    if (!userId && !userAddress) {
      console.error('❌ Missing userId and userAddress');
      toast({
        title: 'Setup incomplete',
        description: 'Your account is not fully set up yet. Please try again in a moment.',
        variant: 'destructive',
      });
      return;
    }

    if (!email || !email.includes('@')) {
      toast({
        title: 'Email required',
        description: 'Please provide a valid email address',
        variant: 'destructive',
      });
      return;
    }

    if (!account) {
      toast({
        title: 'Wallet not connected',
        description: 'Reconnect your wallet and try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      let avatarUrl = currentAvatar;

      if (avatarFile) {
        setIsUploading(true);
        console.log('📤 Uploading avatar via API route...');

        try {
          const formData = new FormData();
          formData.append('file', avatarFile);
          formData.append('userAddress', userAddress);

          const uploadResponse = await fetch('/api/contributor/upload-avatar', {
            method: 'POST',
            body: formData,
          });

          const uploadData = await uploadResponse.json();

          if (!uploadData.success || !uploadData.data?.url) {
            throw new Error(uploadData.error || 'Failed to upload avatar');
          }

          avatarUrl = uploadData.data.url;
          console.log('✅ Avatar uploaded:', avatarUrl);
        } catch (uploadError: any) {
          console.error('❌ Avatar upload failed:', uploadError);
          toast({
            title: 'Upload failed',
            description: uploadError.message || 'Failed to upload avatar. Please try again.',
            variant: 'destructive',
          });
          setIsUploading(false);
          setIsSaving(false);
          return;
        }

        setIsUploading(false);
      }

      // Subscribe to contributor mailing list
      try {
        const subscribeResponse = await fetch('/api/mailing/subscribe-contributor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            userAddress,
            userId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId ?? '') ? userId : undefined,
          }),
        });

        const subscribeData = await subscribeResponse.json();
        if (!subscribeData.success) {
          console.warn('Email subscription failed:', subscribeData.error);
          // Don't block profile save if email subscription fails
        }
      } catch (subscribeError) {
        console.warn('Email subscription error:', subscribeError);
        // Continue with profile save even if email fails
      }

      console.log('💾 Updating contributor profile in database...', { userId, userAddress });
      const finalAlias = alias.trim() || null;
      const finalAvatar = avatarUrl || null;
      const finalBio = bio.trim() || null;

      const response = await walletFetch('/api/contributor/update-profile', account, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Only pass userId if it is a valid UUID (not a wallet address)
          userId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId ?? '') ? userId : undefined,
          userAddress,
          alias: finalAlias,
          avatar: finalAvatar,
          bio: finalBio,
        }),
      });

      console.log('📡 Update profile response status:', response.status);
      const data = await response.json();
      console.log('📡 Update profile response data:', data);

      if (!data.success) {
        throw new Error(data.error || 'Failed to update profile');
      }

      console.log('✅ Contributor profile set up successfully');
      onSaved?.(finalAlias, finalAvatar, finalBio);

      // Broadcast to all components (e.g. connected-chat profileCache, DMs, etc.)
      window.dispatchEvent(new CustomEvent('knead:profile-updated', {
        detail: { address: userAddress.toLowerCase(), alias: finalAlias, avatar: finalAvatar, bio: finalBio },
      }));

      toast({
        title: 'Profile saved!',
        description: 'Your contributor profile has been set up.',
      });

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('❌ ContributorWelcomeModal save error:', error);
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.',
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
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-5 flex items-start justify-between z-10 gap-4 animate-fade-in-up">
              <h1 className="font-adonis text-2xl leading-snug">
                Congratulations, you've been granted Contributor status.
              </h1>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto px-8 py-6 space-y-6" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              <p className="font-georgia-pro text-lg text-gray-800 leading-relaxed animate-fade-in-up-delay">
                This is the highest level you can be awarded in the chat, reserved for special guests or
                Knead Monthly members who've made thoughtful contributions.
              </p>

              <div className="animate-fade-in-up-delay-2 space-y-4">
                <h2 className="font-adonis text-2xl pt-2">What This Means</h2>

                <div className="space-y-4 font-georgia-pro text-lg text-gray-800 leading-relaxed">
                  <p>
                    Contributors are granted full access to the chat, including messaging during non-events,
                    as well as being able to Direct Message + Video Chat with other Contributors in the rolodex.
                  </p>
                  <p>
                    Contributors are allocated a weekly budget of USDC from the Treasury to spend on Knead
                    Monthly members, earning 20% back for each tip they allocate.
                  </p>
                  <p>
                    To encourage passive engagement, your allowance is on a 'use it or lose it' basis.
                  </p>
                  <p>
                    Contributors also get to vote on Demeter proposals, as well as tag @demeter to send Knead Monthly members gifts.
                  </p>
                  <p>
                    If you're a Contributor who earned this status from making good contributions as a Knead
                    Monthly member, your weekly allowance will be higher than appointed guests.
                  </p>
                  <p>
                    Finally, Contributors are also able to set a profile picture, bio, and display name in the chat.
                    Upload a photo below + assign your persona below:
                  </p>
                </div>
              </div>

              {/* Inline settings form */}
              <div className="border border-gray-200 rounded-xl p-6 space-y-6 animate-fade-in-up-delay-3">
                {/* Profile Photo */}
                <div>
                  <label className="block font-adonis text-sm text-gray-700 mb-3">
                    Profile Photo
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {avatarPreview ? (
                        <img
                          src={
                            avatarPreview.startsWith('ipfs://')
                              ? `https://ipfs.thirdwebcdn.com/ipfs/${avatarPreview.replace('ipfs://', '')}`
                              : avatarPreview
                          }
                          alt="Avatar preview"
                          className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                          <User className="w-12 h-12 text-white" />
                        </div>
                      )}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || isSaving}
                        className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                      >
                        <Upload className="w-6 h-6 text-white" />
                      </button>
                    </div>

                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || isSaving}
                        className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-adonis"
                      >
                        {isUploading ? 'Uploading...' : 'Choose Photo'}
                      </button>
                      <p className="text-xs text-gray-500 mt-2">JPG, PNG, or GIF • Max 5MB</p>
                    </div>
                  </div>
                </div>

                {/* Display Name */}
                <div>
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
                  <p className="text-xs text-gray-500 mt-1 italic">
                    If you'd prefer not to use a display name, leaving it blank will default to truncated wallet address
                  </p>
                </div>

                {/* Short Bio */}
                <div>
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

                {/* Email Address (Required) */}
                <div>
                  <label className="block font-adonis text-sm text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contributor@example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-georgia-pro text-sm"
                    disabled={isSaving}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1 italic">
                    Please give us your email to be notified about exclusive events and perks for Contributors:
                  </p>
                </div>

                {/* Save button */}
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-full font-georgia-pro text-sm hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    Skip for now
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || isUploading}
                    className="flex-1 px-4 py-3 bg-black text-white rounded-full font-georgia-pro text-sm hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      'Saving...'
                    ) : isUploading ? (
                      'Uploading...'
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save Profile
                      </>
                    )}
                  </button>
                </div>
              </div>

              <hr className="border-gray-200" />

              {/* Closing thank-you */}
              <p className="font-adonis text-center text-xl leading-relaxed pb-2">
                Thank you so much for your support to Knead's community, we're excited to have you as a Contributor.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
