'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { WalletSummary } from '@/components/wallet-summary';

interface MenuItem {
  icon: string;
  label: string;
  onClick: () => void;
}

interface ChatLayoutProps {
  children: React.ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dmsOpen, setDmsOpen] = useState(false);
  const [logoExpanded, setLogoExpanded] = useState(false);
  const [showExternalWalletMessage, setShowExternalWalletMessage] = useState(false);
  // ✅ REMOVED: showExportInstructions state (no longer needed)
  
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setDmsOpen(true),
    onSwipedRight: () => setMenuOpen(true),
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  const menuItems: MenuItem[] = [
    {
      icon: '🏠',
      label: 'Return Home',
      onClick: () => {
        window.location.href = '/';
      },
    },
  ];

  return (
    <div {...swipeHandlers} className="h-screen bg-white flex flex-col overflow-hidden">
      <header className="border-b border-gray-200 px-4 py-3 relative z-50">
        <div className="flex items-center justify-between">
          <motion.div
            className="cursor-pointer relative"
            onClick={() => setLogoExpanded(!logoExpanded)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.h1
              className="font-adonis text-2xl tracking-tight"
              animate={{ letterSpacing: logoExpanded ? '0.05em' : '0em' }}
              transition={{ duration: 0.2 }}
            >
              {logoExpanded ? 'Knead' : 'K'}
            </motion.h1>
          </motion.div>

          {/* ✅ UPDATED: Removed onExportClick prop */}
          <WalletSummary 
            context="chat"
            onExternalWalletExport={() => setShowExternalWalletMessage(true)}
          />
        </div>

        <AnimatePresence>
          {logoExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-4 mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden z-50 min-w-[220px]"
            >
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  onClick={item.onClick}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-georgia-pro text-sm">{item.label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {logoExpanded && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setLogoExpanded(false)}
          />
        )}
      </header>

      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>

      {/* Side Menus */}
      <AnimatePresence>
        {dmsOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-40"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-adonis text-xl">Direct Messages</h2>
                <button
                  onClick={() => setDmsOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <p className="font-georgia-pro text-sm text-gray-500">
                Coming soon...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 left-0 h-full w-80 bg-white border-r border-gray-200 shadow-xl z-40"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-adonis text-xl">Menu</h2>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <nav className="space-y-2">
                {menuItems.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      item.onClick();
                      setMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-georgia-pro text-sm">{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(dmsOpen || menuOpen) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setDmsOpen(false);
              setMenuOpen(false);
            }}
            className="fixed inset-0 bg-black/20 z-30"
          />
        )}
      </AnimatePresence>

      {/* ✅ KEPT: External Wallet Message Modal (for MetaMask, etc.) */}
      <AnimatePresence>
        {showExternalWalletMessage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl"
            >
              <div className="text-center mb-6">
                <span className="text-6xl">🔐</span>
              </div>

              <h2 className="font-adonis text-2xl text-center mb-4">External Wallet Detected</h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="font-georgia-pro text-sm text-gray-700">
                  You're using <strong>MetaMask, Coinbase, or another external wallet</strong>.
                </p>
                <p className="font-georgia-pro text-sm text-gray-700 mt-3">
                  For security, your private key is managed by your wallet app and is <strong>never accessible to this site</strong>.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-adonis text-sm font-semibold mb-2">To export your private key:</h3>
                <ol className="font-georgia-pro text-sm text-gray-700 space-y-1 list-decimal list-inside">
                  <li>Open your wallet app (MetaMask, Coinbase, etc.)</li>
                  <li>Go to Settings → Security</li>
                  <li>Select "Show Private Key" or "Export Private Key"</li>
                </ol>
              </div>

              <button
                onClick={() => setShowExternalWalletMessage(false)}
                className="w-full px-4 py-3 bg-black text-white rounded-full font-georgia-pro text-sm hover:bg-gray-800 transition"
              >
                Got It
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ✅ REMOVED: Export Instructions Modal (redundant with ThirdWeb's built-in) */}
    </div>
  );
}
