'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ImageLightboxProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
}

export function ImageLightbox({ isOpen, imageUrl, onClose }: ImageLightboxProps) {
  const [imageError, setImageError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);

  // Reset error state and current URL when imageUrl changes
  useEffect(() => {
    if (imageUrl) {
      setCurrentImageUrl(imageUrl);
      setImageError(false);
      setErrorMessage('');
    }
  }, [imageUrl]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  const handleImageError = () => {
    // If the ThirdWeb CDN fails, try the public IPFS gateway as fallback
    if (currentImageUrl.startsWith('https://ipfs.thirdwebcdn.com/ipfs/')) {
      const ipfsPath = currentImageUrl.split('/ipfs/')[1];
      const fallbackUrl = `https://ipfs.io/ipfs/${ipfsPath}`;
      console.warn('ThirdWeb CDN failed, retrying with ipfs.io fallback:', fallbackUrl);
      setCurrentImageUrl(fallbackUrl);
      return; // Don't show error yet — try fallback first
    }

    // If fallback also fails, show the error state
    const usedFallback = currentImageUrl.startsWith('https://ipfs.io/ipfs/');
    setErrorMessage(
      usedFallback
        ? 'Unable to load image from primary CDN or fallback gateway. This may be due to a network error or security policy restriction.'
        : 'Unable to load image. This may be due to a network error or security policy restriction.'
    );
    setImageError(true);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={onClose}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-[101] p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm"
            aria-label="Close lightbox"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Image */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative max-w-[90vw] max-h-[90vh] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {imageError ? (
              <div className="text-white text-center p-8 bg-white/10 rounded-lg backdrop-blur-sm">
                <p className="text-lg mb-2">⚠️ Unable to load image</p>
                <p className="text-sm opacity-80">{errorMessage}</p>
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors"
                >
                  Try opening in new tab
                </a>
              </div>
            ) : imageUrl ? (
              <img
                src={currentImageUrl}
                alt="Image preview"
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                onError={handleImageError}
              />
            ) : (
              <div className="text-white text-center p-8">
                <p>No image URL provided</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
