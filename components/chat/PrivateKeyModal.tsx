'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface PrivateKeyModalProps {
  privateKey: string;
  onClose: () => void;
}

export function PrivateKeyModal({ privateKey, onClose }: PrivateKeyModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(privateKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      alert(
        'Failed to copy to clipboard.\n\n' +
        'Please manually select and copy the private key below.\n\n' +
        (error instanceof Error ? `Error: ${error.message}` : 'Unknown error occurred')
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl"
      >
        {/* Warning Header */}
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚠️</span>
            <h2 className="font-adonis text-xl text-red-900">Security Warning</h2>
          </div>
          <ul className="font-georgia-pro text-sm text-red-800 space-y-1 ml-8">
            <li>• Never share your private key with anyone</li>
            <li>• Anyone with this key can access your funds</li>
            <li>• Store it in a secure location (password manager)</li>
            <li>• Knead will never ask for your private key</li>
          </ul>
        </div>

        {/* Private Key Display */}
        <div className="mb-6">
          <label className="font-georgia-pro text-sm text-gray-600 mb-2 block">
            Your Private Key
          </label>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 break-all font-mono text-xs">
            {privateKey}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 px-4 py-3 bg-black text-white rounded-full font-georgia-pro text-sm hover:bg-gray-800 transition"
          >
            {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-full font-georgia-pro text-sm hover:bg-gray-200 transition"
          >
            Close
          </button>
        </div>

        {/* Additional Info */}
        <p className="font-georgia-pro text-xs text-gray-500 text-center mt-4">
          You can use this key to import your wallet into MetaMask, Coinbase Wallet, or other web3 wallets.
        </p>
      </motion.div>
    </div>
  );
}
