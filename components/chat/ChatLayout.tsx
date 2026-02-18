'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { WalletSummary } from '@/components/wallet-summary';
import { DirectMessageList } from './DirectMessageList';
import { DirectMessageInterface } from './DirectMessageInterface';
import { EventsCalendarModal } from './EventsCalendarModal';
import { AboutFAQModal } from './AboutFAQModal';
import { useActiveAccount } from 'thirdweb/react';
import { useContributorPermissions } from '@/hooks/use-contributor-permissions';
import { Home, Calendar, BookOpen, Send, Landmark } from 'lucide-react';

interface MenuItem {
  icon: React.ReactNode;
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
  const [selectedDm, setSelectedDm] = useState<{ dmId: string; townsDmId: string; otherUserName: string } | null>(null);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [treasuryBalance, setTreasuryBalance] = useState<string>('...');
  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  
  const activeAccount = useActiveAccount();
  const { isContributor, isLoading: contributorLoading } = useContributorPermissions(activeAccount?.address);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle scroll behavior for header reveal/hide (mobile only)
  useEffect(() => {
    if (!isMobile) {
      setHeaderVisible(true); // Always visible on desktop
      return;
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Scrolling up - show header
      if (currentScrollY < lastScrollY || currentScrollY < 10) {
        setHeaderVisible(true);
      } 
      // Scrolling down - hide header
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setHeaderVisible(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isMobile]);
  
  // Only swipe left for DMs on main container
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setDmsOpen(true),
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  // Swipe right to close DM panel
  const dmSwipeHandlers = useSwipeable({
    onSwipedRight: () => {
      setDmsOpen(false);
      setSelectedDm(null);
    },
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  // Fetch treasury balance
  useEffect(() => {
    const fetchTreasuryBalance = async () => {
      try {
        const response = await fetch('/api/treasury/balance');
        const data = await response.json();
        if (data.success && typeof data.balance === 'number') {
          setTreasuryBalance(data.balance.toFixed(2));
        }
      } catch (error) {
        console.error('Error fetching treasury balance:', error);
      }
    };

    fetchTreasuryBalance();
    const interval = setInterval(fetchTreasuryBalance, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const menuItems: MenuItem[] = [
    {
      icon: <Calendar className="w-5 h-5" />,
      label: 'Events Calendar',
      onClick: () => {
        setShowEventsModal(true);
        setLogoExpanded(false);
      },
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      label: 'About / FAQ',
      onClick: () => {
        setShowAboutModal(true);
        setLogoExpanded(false);
      },
    },
    {
      icon: <Home className="w-5 h-5" />,
      label: 'Return Home',
      onClick: () => {
        window.location.href = '/';
      },
    },
  ];

  return (
    <div {...swipeHandlers} className="h-screen bg-white flex flex-col overflow-hidden">
      <motion.header 
        className="border-b border-gray-200 px-4 py-4 relative z-50 bg-white"
        initial={{ y: 0, opacity: 1 }}
        animate={{ 
          y: headerVisible ? 0 : -100,
          opacity: headerVisible ? 1 : 0
        }}
        transition={{ duration: 0.15, ease: 'easeInOut' }}
        style={isMobile ? { position: 'sticky', top: 0 } : { position: 'relative' }}
      >
        <div className="flex items-center justify-between">
          <motion.div
            className="cursor-pointer relative"
            onClick={() => setLogoExpanded(!logoExpanded)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.h1
              className="font-adonis text-3xl tracking-tight"
              animate={{ letterSpacing: logoExpanded ? '0.05em' : '0em' }}
              transition={{ duration: 0.2 }}
            >
              {logoExpanded ? 'Knead' : 'K'}
            </motion.h1>
          </motion.div>

          <div className="flex items-center gap-3">
            <WalletSummary 
              context="chat"
              onExternalWalletExport={() => setShowExternalWalletMessage(true)}
            />

            {/* Paper Plane Icon for DMs (Contributors Only) */}
            {isContributor && !dmsOpen && (
              <button
                onClick={() => setDmsOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Direct Messages"
              >
                <Send className="w-5 h-5 text-gray-700" />
              </button>
            )}
          </div>
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
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
                >
                  {item.icon}
                  <span className="font-georgia-pro text-sm">{item.label}</span>
                </button>
              ))}
              
              {/* Divider */}
              <div className="border-t-2 border-gray-200"></div>
              
              {/* Treasury Balance */}
              <a
                href="https://basescan.org/address/0xde1338f826055a6311d3bbef292dcb92dfe03cde"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
              >
                <Landmark className="w-5 h-5 text-gray-700" />
                <div className="flex-1 text-left">
                  <span className="font-georgia-pro text-sm text-gray-700">
                    Treasury: <span className="font-medium">{treasuryBalance} $TOWNS</span>
                  </span>
                </div>
              </a>
            </motion.div>
          )}
        </AnimatePresence>

        {logoExpanded && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setLogoExpanded(false)}
          />
        )}
      </motion.header>

      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>

      {/* Side Menus */}
      <AnimatePresence>
        {dmsOpen && (
          <motion.div
            {...dmSwipeHandlers}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full lg:w-96 bg-white lg:border-l border-gray-200 shadow-xl z-[60] overflow-hidden"
          >
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="font-adonis text-xl">Direct Messages</h2>
                  <button
                    onClick={() => {
                      setDmsOpen(false);
                      setSelectedDm(null);
                    }}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                {!isContributor ? (
                  <div className="p-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700">
                        🔒 Direct messages are only available to contributors.
                      </p>
                    </div>
                  </div>
                ) : selectedDm ? (
                  <div className="h-full flex flex-col">
                    <div className="p-3 bg-gray-50 border-b border-gray-200">
                      <button
                        onClick={() => setSelectedDm(null)}
                        className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                      >
                        ← Back to DMs
                      </button>
                    </div>
                    <DirectMessageInterface
                      dmId={selectedDm.dmId}
                      townsDmId={selectedDm.townsDmId}
                      currentUserId={activeAccount?.address || ''}
                      otherUserName={selectedDm.otherUserName}
                    />
                  </div>
                ) : (
                  <DirectMessageList
                    userId={activeAccount?.address || ''}
                    onSelectDm={(dmId, townsDmId, otherUserName = 'User') => 
                      setSelectedDm({ dmId, townsDmId, otherUserName })
                    }
                    selectedDmId={selectedDm?.dmId}
                  />
                )}
              </div>
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

      {/* Events Calendar Modal */}
      <EventsCalendarModal
        isOpen={showEventsModal}
        onClose={() => setShowEventsModal(false)}
      />

      {/* About/FAQ Modal */}
      <AboutFAQModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
    </div>
  );
}
