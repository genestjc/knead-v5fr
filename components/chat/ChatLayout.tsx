'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { WalletSummary } from '@/components/wallet-summary';
import { DirectMessageList } from './DirectMessageList';
import { DirectMessageInterface } from './DirectMessageInterface';
import { EventsCalendarModal } from './EventsCalendarModal';
import { AboutFAQModal } from './AboutFAQModal';
import { AnnouncementsModal } from './AnnouncementsModal';
import { useActiveAccount } from 'thirdweb/react';
import { useContributorPermissions } from '@/hooks/use-contributor-permissions';
import { useCustomProfile } from '@/hooks/use-custom-profile';
import { useUserDms, useTimeline, useMyMember } from '@towns-protocol/react-sdk';
import { RiverTimelineEvent } from '@towns-protocol/sdk';
import { Home, Calendar, BookOpen, Megaphone, Send, Landmark, MoreVertical } from 'lucide-react';

const VIDEO_CALL_INVITE_PREFIX = '📹 [VIDEO_CALL_INVITE]';

function DmStreamWatcher({
  streamId,
  onIncomingCall,
}: {
  streamId: string;
  onIncomingCall: (streamId: string, callerAddress: string) => void;
}) {
  const { data: events } = useTimeline(streamId);
  const { userId: myUserId } = useMyMember(streamId);
  const notifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!events || events.length === 0 || !myUserId) return;
    const lastEvent = events[events.length - 1];
    if (lastEvent?.content?.kind !== RiverTimelineEvent.ChannelMessage) return;
    const senderId = lastEvent.sender?.id || '';
    if (senderId === myUserId) return;
    const body = lastEvent.content?.body || '';
    if (!body.startsWith(VIDEO_CALL_INVITE_PREFIX)) return;
    const eventId = (lastEvent as any).eventId || body;
    if (notifiedRef.current === eventId) return;
    notifiedRef.current = eventId;
    onIncomingCall(streamId, senderId);
  }, [events, myUserId, streamId, onIncomingCall]);

  return null;
}

function GlobalDmCallWatcher({
  onIncomingCall,
}: {
  onIncomingCall: (streamId: string, callerAddress: string) => void;
}) {
  const { streamIds } = useUserDms();
  return (
    <>
      {streamIds?.map((streamId) => (
        <DmStreamWatcher key={streamId} streamId={streamId} onIncomingCall={onIncomingCall} />
      ))}
    </>
  );
}

function IncomingCallBanner({
  callerAddress,
  onOpen,
  onDismiss,
}: {
  callerAddress: string;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const profile = useCustomProfile(callerAddress);
  const displayName = profile?.alias || `${callerAddress.slice(0, 6)}...${callerAddress.slice(-4)}`;
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-3 w-[calc(100%-2rem)] max-w-sm">
      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
      <p className="font-georgia-pro text-sm flex-1 min-w-0 truncate">📹 {displayName} is calling</p>
      <button onClick={onOpen} className="px-3 py-1.5 bg-green-600 text-white rounded-full text-sm font-georgia-pro hover:bg-green-700 transition-colors whitespace-nowrap flex-shrink-0">
        Open DM
      </button>
      <button onClick={onDismiss} className="text-gray-400 hover:text-white flex-shrink-0 text-lg leading-none">✕</button>
    </div>
  );
}

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
  const [selectedDm, setSelectedDm] = useState<{
    dmId: string;
    townsDmId: string;
    otherUserName: string;
    otherUserAvatar?: string
  } | null>(null);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
  const [treasuryBalance, setTreasuryBalance] = useState<string>('...');
  
  const [dmPanelEverOpened, setDmPanelEverOpened] = useState(false);
  const [showDmOptionsMenu, setShowDmOptionsMenu] = useState(false);
  const [dmRequestsEnabled, setDmRequestsEnabled] = useState(true);
  const dmOptionsRef = React.useRef<HTMLDivElement>(null);
  const dmRefreshFnRef = React.useRef<(() => void) | null>(null);
  const [incomingDmCall, setIncomingDmCall] = useState<{ streamId: string; callerAddress: string } | null>(null);

  const activeAccount = useActiveAccount();
  const { isContributor, isLoading: contributorLoading } = useContributorPermissions(activeAccount?.address);

  const handleIncomingCall = useCallback((streamId: string, callerAddress: string) => {
    setIncomingDmCall({ streamId, callerAddress });
  }, []);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      setDmsOpen(true);
      if (!dmPanelEverOpened) {
        setDmPanelEverOpened(true);
      }
    },
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  const dmSwipeHandlers = useSwipeable({
    onSwipedRight: () => {
      setDmsOpen(false);
      setSelectedDm(null);
    },
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

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
    const interval = setInterval(fetchTreasuryBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dmOptionsRef.current && !dmOptionsRef.current.contains(e.target as Node)) {
        setShowDmOptionsMenu(false);
      }
    };
    if (showDmOptionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDmOptionsMenu]);

  const menuItems: MenuItem[] = [
    {
      icon: <Calendar className="w-5 h-5" />,
      label: 'Events',
      onClick: () => {
        setShowEventsModal(true);
        setLogoExpanded(false);
      },
    },
    {
      icon: <Megaphone className="w-5 h-5" />,
      label: 'Announcements',
      onClick: () => {
        setShowAnnouncementsModal(true);
        setLogoExpanded(false);
      },
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      label: 'About',
      onClick: () => {
        setShowAboutModal(true);
        setLogoExpanded(false);
      },
    },
    {
      icon: <Home className="w-5 h-5" />,
      label: 'Home',
      onClick: () => {
        window.location.href = '/';
      },
    },
  ];

  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const shouldShowMainChat = !isMobile || !dmsOpen;

  return (
    <div {...swipeHandlers} className="h-screen bg-white flex flex-col">
      <header className="fixed top-0 left-0 right-0 border-b border-gray-200 px-4 py-2 lg:py-4 z-50 bg-white">
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
            
            {isContributor && !dmsOpen && (
              <button
                onClick={() => {
                  setDmsOpen(true);
                  if (!dmPanelEverOpened) {
                    setDmPanelEverOpened(true);
                  }
                }}
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
              
              <div className="border-t-2 border-gray-200"></div>
              
              <a
                href="https://basescan.org/address/0xe0c1EeBc42553C2a814905E5f73e5Fde2c52D8Fa"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
              >
                <Landmark className="w-5 h-5 text-gray-700" />
                <div className="flex-1 text-left">
                  <span className="font-georgia-pro text-sm text-gray-700">
                    Treasury: <span className="font-medium">${treasuryBalance}</span>
                  </span>
                </div>
              </a>
            </motion.div>
          )}
        </AnimatePresence>

        {logoExpanded && (
          <div className="fixed inset-0 z-40" onClick={() => setLogoExpanded(false)} />
        )}
      </header>

      <div className="h-[72px] lg:h-[88px] flex-shrink-0" />

      {/* ✅ OPTIMIZED: Hide instead of unmount - keeps SDK subscriptions alive */}
      <main className="flex-1 overflow-hidden relative min-h-0">
        <div className={`h-full ${shouldShowMainChat ? '' : 'hidden'}`}>
          {children}
        </div>
      </main>

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
                  <button
                    onClick={() => setSelectedDm(null)}
                    className="font-adonis text-xl hover:text-gray-600 transition-colors text-left"
                    title={selectedDm ? 'Back to Direct Messages' : undefined}
                  >
                    Direct Messages
                  </button>
                  <div className="flex items-center gap-1">
                    <div className="relative" ref={dmOptionsRef}>
                      <button
                        onClick={() => setShowDmOptionsMenu(!showDmOptionsMenu)}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                        title="More options"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      {showDmOptionsMenu && (
                        <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                          <button
                            onClick={() => { dmRefreshFnRef.current?.(); setShowDmOptionsMenu(false); }}
                            className="w-full text-left px-4 py-3 text-sm font-georgia-pro hover:bg-gray-50 rounded-t-lg transition-colors"
                          >
                            Refresh DMs
                          </button>
                          <button
                            onClick={() => { setDmRequestsEnabled(!dmRequestsEnabled); setShowDmOptionsMenu(false); }}
                            className="w-full text-left px-4 py-3 text-sm font-georgia-pro hover:bg-gray-50 rounded-b-lg transition-colors border-t border-gray-100"
                          >
                            {dmRequestsEnabled ? 'Turn off DM requests' : 'Turn on DM requests'}
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => { setDmsOpen(false); setSelectedDm(null); }}
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <span className="text-xl leading-none">✕</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {!isContributor ? (
                  <div className="p-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700 font-georgia-pro">
                        🔒 Direct messages are only available to contributors.
                      </p>
                    </div>
                  </div>
                ) : selectedDm ? (
                  <div className="h-full flex flex-col">
                    <div className="p-3 bg-gray-50 border-b border-gray-200">
                      <button
                        onClick={() => setSelectedDm(null)}
                        className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1 font-georgia-pro"
                      >
                        ← Back to DMs
                      </button>
                    </div>
                    
                    <DirectMessageInterface
                      dmId={selectedDm.dmId}
                      townsDmId={selectedDm.townsDmId}
                      currentUserId={activeAccount?.address || ''}
                      otherUserName={selectedDm.otherUserName}
                      otherUserAvatar={selectedDm.otherUserAvatar}
                    />
                  </div>
                ) : (
                  dmPanelEverOpened && (
                    <DirectMessageList
                      userId={activeAccount?.address || ''}
                      onSelectDm={(dmId, townsDmId, otherUserName = 'User', otherUserAvatar) =>
                        setSelectedDm({ dmId, townsDmId, otherUserName, otherUserAvatar })
                      }
                      selectedDmId={selectedDm?.dmId}
                      onRefreshReady={(fn) => { dmRefreshFnRef.current = fn; }}
                      dmRequestsEnabled={dmRequestsEnabled}
                    />
                  )
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
                  For security, your private key is managed by your wallet app and is{' '}
                  <strong>never accessible to this site</strong>.
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

      <EventsCalendarModal isOpen={showEventsModal} onClose={() => setShowEventsModal(false)} />
      <AboutFAQModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} />
      <AnnouncementsModal isOpen={showAnnouncementsModal} onClose={() => setShowAnnouncementsModal(false)} />

      {isContributor && (
        <GlobalDmCallWatcher onIncomingCall={handleIncomingCall} />
      )}

      {incomingDmCall && (
        <IncomingCallBanner
          callerAddress={incomingDmCall.callerAddress}
          onOpen={() => {
            setDmsOpen(true);
            setDmPanelEverOpened(true);
            setSelectedDm({
              dmId: incomingDmCall.streamId,
              townsDmId: incomingDmCall.streamId,
              otherUserName: incomingDmCall.callerAddress.slice(0, 6) + '...' + incomingDmCall.callerAddress.slice(-4),
            });
            setIncomingDmCall(null);
          }}
          onDismiss={() => setIncomingDmCall(null)}
        />
      )}
    </div>
  );
}
