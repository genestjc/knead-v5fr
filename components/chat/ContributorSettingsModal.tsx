'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, User, Check, Settings } from 'lucide-react';
import { uploadToIPFS } from '@/lib/thirdweb/storage';
import { useToast } from '@/hooks/use-toast';

interface ContributorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
  currentAlias?: string;
  currentAvatar?: string;
  userId: string;
}

export function ContributorSettingsModal({
  isOpen,
  onClose,
  userAddress,
  currentAlias,
  currentAvatar,
  userId,
}: ContributorSettingsModalProps) {
  const [alias, setAlias] = useState(currentAlias || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(currentAvatar || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setAlias(currentAlias || '');
      setAvatarPreview(currentAvatar || '');
      setAvatarFile(null);
    }
  }, [isOpen, currentAlias, currentAvatar]);

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
    setIsSaving(true);

    try {
      let avatarUrl = currentAvatar;

      if (avatarFile) {
        setIsUploading(true);
        console.log('📤 Uploading avatar to IPFS...');
        
        try {
          avatarUrl = await uploadToIPFS(avatarFile);
          console.log('✅ Avatar uploaded:', avatarUrl);
        } catch (uploadError) {
          console.error('❌ IPFS upload failed:', uploadError);
          toast({
            title: 'Upload failed',
            description: 'Failed to upload avatar to IPFS. Please try again.',
            variant: 'destructive',
          });
          setIsUploading(false);
          setIsSaving(false);
          return;
        }
        
        setIsUploading(false);
      }

      console.log('💾 Updating profile in database...');
      const response = await fetch('/api/contributor/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userAddress,
          alias: alias.trim() || null,
          avatar: avatarUrl || null,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update profile');
      }

      console.log('✅ Profile updated successfully');

      toast({
        title: 'Profile updated!',
        description: 'Your contributor settings have been saved.',
      });

      setTimeout(() => {
        console.log('🔄 Reloading to re-initialize Towns with updated profile...');
        onClose();
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('❌ Save error:', error);
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-gray-700" />
              <h2 className="font-adonis text-2xl">Contributor Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-6">
            <label className="block font-adonis text-sm text-gray-700 mb-3">
              Profile Photo
            </label>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
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
                
                <p className="text-xs text-gray-500 mt-2">
                  JPG, PNG, or GIF • Max 5MB
                </p>
              </div>
            </div>
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
            <p className="text-xs text-gray-500 mt-1">
              Optional • Shown instead of wallet address
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              💡 <strong>Your profile is public</strong>
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Other contributors will see your display name and photo in chat.
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
                  Save Changes
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
