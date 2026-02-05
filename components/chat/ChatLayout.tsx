'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { useActiveWallet, useConnectModal } from 'thirdweb/react';
import { getContract } from 'thirdweb';
import { transfer } from 'thirdweb/extensions/erc20';
import { toWei } from 'thirdweb';
import { client, activeChain } from '@/thirdweb-client';
import { createWallet, inAppWallet } from 'thirdweb/wallets';

// ✅ Define wallets array for Connect modal
const wallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  inAppWallet({
    auth: {
      options: ["email", "google", "apple", "phone"],
    },
    hidePrivateKeyExport: false,
    executionMode: {
      mode: "EIP7702",
      sponsorGas: true,
    },
  }),
];

interface MenuItem {
  icon: string;
  label: string;
  onClick: () => void;
}

interface ChatLayoutProps {
  children: React.ReactNode;
}

/**
 * iMessage-inspired Chat Layout
 * 
 * Features:
 * - Animated expandable logo header
 * - Swipe gestures (right = menu, left = DMs)
 * - Clean, minimal design
 * - Non-custodial wallet features (export key, withdraw tokens)
 */
export function ChatLayout({ children }: ChatLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dmsOpen, setDmsOpen] = useState(false);
  const [logoExpanded, setLogoExpanded] = useState(false);
  
  const wallet = useActiveWallet();
  const { connect } = useConnectModal();

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setDmsOpen(true),
    onSwipedRight: () => setMenuOpen(true),
    trackMouse: true, // Desktop support
    preventScrollOnSwipe: true,
  });

  // Handle private key export via ThirdWeb Connect modal
  const handleExportPrivateKey = () => {
    if (!wallet) {
     import { useToast } from '@/hooks/use-toast';

const { toast } = useToast();

toast({
  title: "Wallet Not Connected",
  description: "Please connect your wallet first",
  variant: "destructive"
});
      setLogoExpanded(false);
      return;
    }

    // Open ThirdWeb Connect modal
    connect({ 
      client,
      wallets,
    });
    
    // Show instructions
    setTimeout(() => {
      alert(
        '📱 Connect Modal Opened\n\n' +
        'To export your private key:\n' +
        '1. Click "Manage Wallet"\n' +
        '2. Select "Export Private Key"\n' +
        '3. Follow the security prompts\n\n' +
        '🔒 Your key is never sent to our servers.\n' +
        'This ensures your wallet is truly non-custodial.'
      );
    }, 500);
    
    setLogoExpanded(false);
  };

  // Handle token withdrawal
  const handleWithdraw = async () => {
    if (!wallet) {
      alert('Please connect your wallet first');
      setLogoExpanded(false);
      return;
    }

    const withdrawAmount = prompt('How many $TOWNS tokens do you want to withdraw?');
    if (!withdrawAmount) {
      setLogoExpanded(false);
      return;
    }

    // Validate amount is a valid positive number
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Invalid amount. Please enter a valid positive number.');
      setLogoExpanded(false);
      return;
    }

    const destinationAddress = prompt(
      'Enter destination wallet address:\n' +
      '(e.g., your Coinbase wallet address)'
    );
    
    if (!destinationAddress) {
      setLogoExpanded(false);
      return;
    }

    // Validate Ethereum address format (0x followed by 40 hex characters)
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(destinationAddress)) {
      alert('Invalid wallet address. Please enter a valid Ethereum address (0x followed by 40 hex characters).');
      setLogoExpanded(false);
      return;
    }

    try {
      const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
      if (!townsContractAddress) {
        throw new Error('TOWNS contract address not configured');
      }

      const contract = getContract({
        client,
        chain: activeChain,
        address: townsContractAddress,
      });

      const tx = transfer({
        contract,
        to: destinationAddress,
        amount: toWei(amount.toString()),
      });

      console.log('🔄 Sending withdrawal transaction...');
      const receipt = await wallet.sendTransaction({ transaction: tx });
      
      alert(
        `✅ Withdrawal successful!\n\n` +
        `Amount: ${amount} $TOWNS\n` +
        `To: ${destinationAddress}\n\n` +
        `Transaction: ${receipt.transactionHash}\n` +
        `View on BaseScan: https://basescan.org/tx/${receipt.transactionHash}`
      );
      
      setLogoExpanded(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Withdrawal error:', error);
      alert(`❌ Withdrawal failed: ${errorMessage}`);
      setLogoExpanded(false);
    }
  };

  const menuItems: MenuItem[] = [
    {
      icon: '💰',
      label: 'Withdraw Earnings',
      onClick: handleWithdraw,
    },
    {
      icon: '🏠',
      label: 'Return Home',
      onClick: () => {
        window.location.href = '/';
      },
    },
    {
      icon: '🔑',
      label: 'Export Private Key',
      onClick: handleExportPrivateKey,
    },
  ];

  return (
    <div {...swipeHandlers} className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Animated Logo Header */}
      <header className="border-b border-gray-200 px-4 py-3 relative z-50">
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

        {/* Menu Dropdown */}
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

        {/* Close dropdown on outside click */}
        {logoExpanded && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setLogoExpanded(false)}
          />
        )}
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>

      {/* Side Menus - Placeholder for future implementation */}
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

      {/* Overlay for side menus */}
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
    </div>
  );
}
