'use client';

import { useEffect, useRef } from 'react';
import { X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function convertIpfsToGatewayUrl(url: string): string {
  if (url.startsWith('ipfs://')) {
    return `https://ipfs.thirdwebcdn.com/ipfs/${url.replace('ipfs://', '')}`;
  }
  return url;
}

interface UserProfilePopupProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  avatar?: string;
  bio?: string;
  address?: string;
}

export function UserProfilePopup({
  isOpen,
  onClose,
  name,
  avatar,
  bio,
  address,
}: UserProfilePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200] p-4"
          onClick={onClose}
        >
          <motion.div
            ref={popupRef}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <div className="flex justify-end px-4 pt-4">
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Profile content */}
            <div className="flex flex-col items-center px-8 pb-8 pt-2 gap-4">
              {/* Avatar */}
              <div className="relative">
                {avatar ? (
                  <img
                    src={convertIpfsToGatewayUrl(avatar)}
                    alt={name}
                    className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                    <User className="w-10 h-10 text-white" />
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="text-center">
                <p className="font-adonis text-xl text-gray-900 leading-tight">{name}</p>
                {address && (
                  <p className="text-xs text-gray-400 mt-1 font-georgia-pro">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </p>
                )}
              </div>

              {/* Bio */}
              {bio && (
                <p className="font-georgia-pro text-sm text-gray-600 text-center leading-relaxed">
                  {bio}
                </p>
              )}

              {!bio && (
                <p className="font-georgia-pro text-sm text-gray-400 text-center italic">
                  No bio yet.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
