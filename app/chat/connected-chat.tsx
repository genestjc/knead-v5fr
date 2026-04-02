'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  useAgentConnection, 
  useSendMessage, 
  useScrollback,
  useTimeline,
  useSyncAgent,
  useReactions
} from '@towns-protocol/react-sdk';
import { RiverTimelineEvent } from '@towns-protocol/sdk';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { MessageBubble, EventBanner, TypingIndicator } from '@/components/chat/MessageBubble';
import { BanScreen } from '@/components/chat/BanScreen';
import { FreemiumBanner } from '@/components/chat/FreemiumBanner';
import { DailyProvider } from '@/components/chat/DailyProvider';
import { EventVideoStage } from '@/components/chat/EventVideoStage';
import MuxPlayer from '@mux/mux-player-react';
import { WelcomeModal } from '@/components/chat/WelcomeModal';
import { ContributorWelcomeModal } from '@/components/chat/ContributorWelcomeModal';
import type { ChatUser, ChatEvent } from '@/types/chat';
import { useActiveAccount } from 'thirdweb/react';
import { useFreemiumChatTimer } from '@/hooks/use-freemium-chat-timer';
import { useContributorPermissions } from '@/hooks/use-contributor-permissions';
import { useChatPermissions } from '@/hooks/use-chat-permissions';
import { useTypingIndicator } from '@/hooks/use-typing-indicator';
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { uploadToIPFS, isImageFile } from '@/lib/thirdweb/storage';
import { Paperclip, X, Reply } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

interface ConnectedChatProps {
  currentUser: ChatUser;
  spaceId: string;
  defaultChannelId: string;
}

interface UserProfile {
  alias: string | null;
  avatar: string | null;
  displayName: string;
  walletAddress: string | null;
  role?: string;
}

// ✅ MODIFIED: Accept paymentIntentId from Stripe
function PaymentForm({
  onSuccess,
}: {
  onSuccess: (paymentIntentId: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    // ✅ CHANGED: Stay on page with redirect: 'if_required'
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required', // ← Don't redirect
    });

    if (error) {
      setErrorMessage(error.message || 'An error occurred during payment.');
      setIsProcessing(false);
      return;
    }

    // ✅ NEW: Pass paymentIntentId to parent
    if (paymentIntent && paymentIntent.id) {
      onSuccess(paymentIntent.id);
    } else {
      setErrorMessage('Payment completed but no payment intent returned.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />
      {errorMessage && (
        <div className="text-red-600 text-sm font-georgia-pro">
          {errorMessage}
        </div>
      )}
      <div className="flex flex-col items-center gap-3">
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="inline-flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors font-adonis w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </>
          ) : (
            'Join Today'
          )}
        </button>
      </div>
    </form>
  );
}

function PermissionDebugBanner({
  permissions,
  userRole,
  activeEvent,
}: {
  permissions: any;
  userRole: string;
  activeEvent: any;
}) {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex gap-4">
          <span>Role: <strong>{userRole}</strong></span>
          <span>Can post: <strong>{permissions?.canPost ? '✅' : '❌'}</strong></span>
          <span>Event: <strong>{activeEvent?.title || '❌ None'}</strong></span>
        </div>
        <span className="text-gray-600">{permissions?.reason}</span>
      </div>
    </div>
  );
}

function RetryMessageBanner({
  message,
  onRetry,
  onCancel,
}: {
  message: string;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800">❌ Message failed to send</p>
          <p className="text-xs text-red-600 truncate mt-1">"{message}"</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onRetry}
            className="px-3 py-1.5 bg-red-600 text-white rounded-full text-sm hover:bg-red-700 whitespace-nowrap"
          >
            Retry
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-full text-sm hover:bg-gray-300 whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConnectedChat(props: ConnectedChatProps) {
  const { isAgentConnected, isAgentConnecting } = useAgentConnection();

  if (isAgentConnecting) {
    return (
      <ChatLayout>
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-500">Connecting to Towns Protocol...</p>
        </div>
      </ChatLayout>
    );
  }

  if (!isAgentConnected) {
    return (
      <ChatLayout>
        <div className="text-center py-10">
          <p className="font-georgia-pro text-lg text-red-500">❌ Not connected to Towns Protocol</p>
          <p className="font-georgia-pro text-sm text-gray-600 mt-2">
            Please connect your wallet to use the chat
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800"
          >
            Retry Connection
          </button>
        </div>
      </ChatLayout>
    );
  }

  return <ConnectedChatInner {...props} />;
}

function ConnectedChatInner({ currentUser, spaceId, defaultChannelId }: ConnectedChatProps) {
  const syncAgent = useSyncAgent();
  
  const [messageInput, setMessageInput] = useState('');
  const [activeEvent, setActiveEvent] = useState<ChatEvent | null>(null);
  const [dailyToken, setDailyToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'freemium' | 'participant' | 'contributor'>('freemium');
  const [isAdmin, setIsAdmin] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; previewUrl: string } | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, UserProfile>>({});
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasReachedStart, setHasReachedStart] = useState(false);
  const [scrollbackFailed, setScrollbackFailed] = useState(false);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const [quotedMessage, setQuotedMessage] = useState<{ content: string; sender: string } | null>(null);
  
  const [contributorAddresses, setContributorAddresses] = useState<Set<string>>(new Set());

  // 🆕 Modal states
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showContributorModal, setShowContributorModal] = useState(false);

  // 💳 Stripe modal states
  const [isStripeModalOpen, setIsStripeModalOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoadingIntent, setIsLoadingIntent] = useState(false);
  
  // ✅ NEW: Payment verification states
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const profileFetchingRef = useRef<Set<string>>(new Set());
  const lastMessageIdRef = useRef<string | null>(null);

  const activeAccount = useActiveAccount();
  const { toast } = useToast();
  const { remainingMinutes } = useFreemiumChatTimer(activeAccount?.address || null);
  const { canAwardTokens } = useContributorPermissions(activeAccount?.address);
  const { permissions, isBanned } = useChatPermissions(activeAccount?.address || null);
  
  const { startTyping, stopTyping } = useTypingIndicator({
    clearDelay: 3000,
  });
  
  const channelId = defaultChannelId;

  const { data: events, isLoading: isTimelineLoading, isError: isTimelineError } = useTimeline(channelId);
  const { sendMessage, isPending: isSending } = useSendMessage(channelId);
  const {
    scrollback,
    isPending: isScrollbackPending,
  } = useScrollback(channelId, {
    onError: (err: Error) => {
      console.error('[scrollback] failed:', err.message);
      setScrollbackFailed(true);
    },
  });
  const { data: reactionsData } = useReactions(channelId);

  const canReact = useMemo(() => {
    return userRole !== 'freemium';
  }, [userRole]);

  // 💳 MODIFIED: Stripe payment handler with verification
  const handleOpenPaymentModal = async () => {
    if (!activeAccount?.address) {
      toast({
        title: 'Wallet Required',
        description: 'Please connect your wallet first.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingIntent(true);

    try {
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: activeAccount.address,
          amount: 500,
        }),
      });

      const data = await response.json();

      if (data.error) {
        toast({
          title: 'Error',
          description: `Failed to initialize payment: ${data.error}`,
          variant: 'destructive',
        });
      } else if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setIsStripeModalOpen(true);
      } else {
        toast({
          title: 'Error',
          description: 'Unexpected error. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating payment intent:', error);
      toast({
        title: 'Error',
        description: 'Failed to initialize payment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingIntent(false);
    }
  };

  // ✅ NEW: Handle payment success with server-side verification
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    if (!activeAccount?.address) return;

    setIsVerifying(true);
    setIsStripeModalOpen(false); // Close payment modal

    try {
      console.log('[chat] Verifying payment:', paymentIntentId);

      // Verify payment server-side
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId,
          walletAddress: activeAccount.address,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // ✅ Payment verified! Grant chat access immediately
        console.log('[chat] ✅ Payment verified, unlocking chat');
        setPaymentVerified(true);
        setIsVerifying(false);

        toast({
          title: 'Welcome to Knead Monthly! 🎉',
          description: 'Chat access unlocked. Start participating!',
        });

        // Background: Refresh membership
        localStorage.removeItem('knead_membership_cache');

        window.dispatchEvent(new CustomEvent('membershipUpdated'));

        // Auto-reload after showing success toast so membership takes effect
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        console.error('[chat] ❌ Verification failed:', result.error);
        setIsVerifying(false);
        toast({
          title: 'Verification Failed',
          description: result.error || 'Could not verify payment.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[chat] Error verifying payment:', error);
      setIsVerifying(false);
      toast({
        title: 'Error',
        description: 'Failed to verify payment. Please refresh.',
        variant: 'destructive',
      });
    }
  };

  // 🆕 Welcome Modal - Show on first chat entry
  useEffect(() => {
    if (!activeAccount?.address || !events) return;
    
    const hasSeenWelcome = localStorage.getItem(`welcome_seen_${activeAccount.address}`);
    if (!hasSeenWelcome) {
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeAccount?.address, events]);

  // 🆕 Contributor Modal - Show when user becomes contributor
  useEffect(() => {
    if (!activeAccount?.address || userRole !== 'contributor') return;
    
    const hasSeenContributor = localStorage.getItem(`contributor_welcome_${activeAccount.address}`);
    if (!hasSeenContributor) {
      setShowContributorModal(true);
    }
  }, [userRole, activeAccount?.address]);

  // 🆕 Modal handlers
  const handleWelcomeClose = () => {
    if (activeAccount?.address) {
      localStorage.setItem(`welcome_seen_${activeAccount.address}`, 'true');
    }
    setShowWelcomeModal(false);
    window.location.reload();
  };

  const handleContributorClose = () => {
    if (activeAccount?.address) {
      localStorage.setItem(`contributor_welcome_${activeAccount.address}`, 'true');
    }
    setShowContributorModal(false);
  };

  // Listen for reply events
  useEffect(() => {
    const handleReply = (event: Event) => {
      const customEvent = event as CustomEvent<{ content: string; sender: string }>;
      setQuotedMessage(customEvent.detail);
      setTimeout(() => {
        const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
        textarea?.focus();
      }, 100);
    };
    window.addEventListener('reply-to-message', handleReply);
    return () => window.removeEventListener('reply-to-message', handleReply);
  }, []);

  // Channel join is handled by TownsChatJoinFlow (joinSpace covers channels).
  // Calling channel.join() a second time here resets the stream sync position
  // and causes "Miniblock number out of order" errors for new accounts.

  // DIAGNOSTIC: Log raw event shape
  useEffect(() => {
    if (events && events.length > 0) {
      console.log('🔍 Raw timeline event sample:', events[0]);
    }
  }, [events]);

  // DIAGNOSTIC: Log reactions data
  useEffect(() => {
    if (reactionsData) {
      console.log('🔍 Reactions data sample:', reactionsData);
    }
  }, [reactionsData]);

  const getProfile = useCallback(async (walletAddress: string) => {
    try {
      const response = await fetch(`/api/chat/user?address=${walletAddress}`);
      const data = await response.json();

      if (data.success && data.user) {
        setProfileCache(prev => ({
          ...prev,
          [walletAddress]: {
            alias: data.user.alias,
            avatar: data.user.avatar,
            displayName: data.user.displayName,
            walletAddress,
            role: data.user.role,
          },
        }));
      }
    } catch {
      // Silent
    }
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || hasReachedStart || isScrollbackPending) return;

    const scrollContainer = scrollContainerRef.current;
    const oldScrollHeight = scrollContainer?.scrollHeight ?? 0;
    const oldScrollTop = scrollContainer?.scrollTop ?? 0;

    setIsLoadingMore(true);
    setScrollbackFailed(false);

    try {
      // scrollback() fetches older miniblocks from the river node.
      // The onError config above sets scrollbackFailed if the node rejects the request.
      const result = await scrollback();

      if (result?.terminus) {
        setHasReachedStart(true);
      }

      if (scrollContainer) {
        requestAnimationFrame(() => {
          const newScrollHeight = scrollContainer.scrollHeight;
          const heightDiff = newScrollHeight - oldScrollHeight;
          scrollContainer.scrollTop = oldScrollTop + heightDiff;
        });
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasReachedStart, isScrollbackPending, scrollback]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || hasReachedStart) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          loadMoreMessages();
        }
      },
      { threshold: 0.1, root: scrollContainerRef.current }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreMessages, hasReachedStart, isLoadingMore]);

  // When the timeline finishes loading with very few events (e.g. after a river node
  // resource_exhausted cleared the local cache), automatically kick off a scrollback so
  // historical messages are fetched without requiring the user to scroll to the sentinel.
  // Gate on !isTimelineLoading so we don't race with the SDK's own sync.
  useEffect(() => {
    if (isTimelineLoading || hasReachedStart || isLoadingMore || isScrollbackPending) return;
    if (events.length < 5) {
      loadMoreMessages();
    }
  // Only re-run when the timeline finishes loading or event count crosses the threshold.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimelineLoading, events.length]);

  useEffect(() => {
    if (!events || events.length === 0) return;

    const addresses = events
      .map((event: any) => event.sender?.id)
      .filter(
        (addr): addr is string =>
          !!addr && !profileCache[addr] && !profileFetchingRef.current.has(addr),
      );

    addresses.forEach((addr) => {
      profileFetchingRef.current.add(addr);
      getProfile(addr);
    });
  // profileCache intentionally omitted from deps — profileFetchingRef deduplicates fetches.
  // Including profileCache caused re-runs every second (driven by the freemium countdown timer).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, getProfile]);

  const messages = useMemo(() => {
    if (!events) return [];

    return events
      .filter((event: any) => event.content?.kind === RiverTimelineEvent.ChannelMessage)
      .map((event: any) => {
        const walletAddress = event.sender?.id || '';
        const profile = walletAddress ? profileCache[walletAddress] : null;

        const messageReactions = reactionsData?.[event.eventId];
        const reactionCounts: Record<string, number> = {};
        
        if (messageReactions && typeof messageReactions === 'object') {
          Object.entries(messageReactions).forEach(([emoji, users]: [string, any]) => {
            if (users && typeof users === 'object' && !Array.isArray(users)) {
              const userCount = Object.keys(users).length;
              if (userCount > 0) {
                reactionCounts[emoji] = userCount;
              }
            }
          });
        }

        return {
          id: event.eventId,
          content: event.content?.body || null,
          isDecrypting: !event.content?.body,
          sender: {
            id: walletAddress,
            walletAddress,
            name: profile?.alias || profile?.displayName || event.creatorDisplayName || 'Anonymous',
            avatar: profile?.avatar,
          },
          timestamp: event.createdAtEpochMs || event.timestamp || Date.now(),
          isOwn: walletAddress?.toLowerCase() === activeAccount?.address?.toLowerCase(),
          isContributor: false,
          reactionCounts,
        };
      })
      .sort((a: any, b: any) => a.timestamp - b.timestamp);
  }, [events, profileCache, activeAccount?.address, reactionsData]);
  
  // Blockchain contributor checking
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const checkContributorStatus = async () => {
      const uniqueAddresses = [...new Set(
        messages
          .map(msg => msg.sender.walletAddress)
          .filter((addr): addr is string => 
            !!addr && 
            addr !== activeAccount?.address &&
            !contributorAddresses.has(addr)
          )
      )];

      if (uniqueAddresses.length === 0) return;

      const newContributorAddresses = new Set(contributorAddresses);
      let foundNewContributors = false;

      await Promise.all(
        uniqueAddresses.map(async (address) => {
          try {
            const roleInfo = await getUserRole(address);
            if (roleInfo.role === 'contributor') {
              newContributorAddresses.add(address);
              foundNewContributors = true;
            }
          } catch (error) {
            console.error('Failed to check contributor status for:', address, error);
          }
        })
      );

      if (foundNewContributors) {
        setContributorAddresses(newContributorAddresses);
      }
    };

    checkContributorStatus();
  }, [messages, activeAccount?.address, contributorAddresses]);

  const messagesWithContributorStatus = useMemo(() => {
    return messages.map(msg => ({
      ...msg,
      isContributor: msg.sender.walletAddress 
        ? contributorAddresses.has(msg.sender.walletAddress)
        : false,
    }));
  }, [messages, contributorAddresses]);

  // Sync userRole from the server-side permissions API (avoids CORS from direct client-side RPC calls)
  useEffect(() => {
    if (permissions?.role) {
      setUserRole(permissions.role);
    }
  }, [permissions?.role]);

  useEffect(() => {
    if (!activeAccount?.address) return;

    async function fetchAdminStatus() {
      try {
        const response = await fetch(`/api/chat/user?address=${activeAccount!.address}`);
        const data = await response.json();
        if (data.success && data.user) {
          setIsAdmin(data.user.role === 'admin' || data.user.role === 'master-admin');
        }
      } catch {
        // Silent
      }
    }

    fetchAdminStatus();
  }, [activeAccount?.address]);

  useEffect(() => {
    if (!activeAccount?.address) return;

    async function fetchLiveEvent() {
      try {
        const response = await fetch('/api/events?status=live', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        const data = await response.json();

        if (!data.success || !data.data?.length) {
          setActiveEvent(null);
          setDailyToken(null);
          return;
        }

        const event = data.data[0];
        setActiveEvent(event);

        const userAddress = activeAccount.address!.toLowerCase();
        const isHost = event.host?.address?.toLowerCase() === userAddress;
        const isGuest = event.guestAddresses?.some(
          (addr: string) => addr.toLowerCase() === userAddress,
        );
        const isViewer = !isHost && !isGuest;

        if (!event.videoEnabled || !event.dailyRoomName) {
          setDailyToken(null);
          return;
        }

        const tokenResponse = await fetch('/api/events/generate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: event.dailyRoomName,
            walletAddress: activeAccount.address,
            isHost,
            isGuest,
            isViewer,
          }),
        });
        const tokenData = await tokenResponse.json();
        setDailyToken(tokenData.success ? tokenData.data?.token : null);
      } catch {
        setActiveEvent(null);
        setDailyToken(null);
      }
    }

    fetchLiveEvent();
    const interval = setInterval(fetchLiveEvent, 30000);

    const supabase = createSupabaseClient();
    const channel = supabase
      .channel('chat_live_events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_events' }, fetchLiveEvent)
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [activeAccount?.address]);

  useEffect(() => {
    if (messagesWithContributorStatus.length === 0) return;

    const lastMessage = messagesWithContributorStatus[messagesWithContributorStatus.length - 1];
    const lastMessageId = lastMessage?.id;

    if (lastMessageIdRef.current === null) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
      lastMessageIdRef.current = lastMessageId;
      return;
    }

    if (lastMessageId !== lastMessageIdRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      lastMessageIdRef.current = lastMessageId;
    }
  }, [messagesWithContributorStatus]);

  if (isBanned) {
    return (
      <ChatLayout>
        <BanScreen />
      </ChatLayout>
    );
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    stopTyping();
    setShowTypingIndicator(false);

    if (isBanned) {
      alert('You are banned from Knead chat.');
      return;
    }

    if (!permissions?.canPost) {
      if (userRole === 'freemium') {
        alert('Free Members can enjoy viewing for 1 hour per month. Sign-up for Knead Monthly to participate in events.');
      } else if (userRole === 'participant' && !activeEvent) {
        alert('Messaging is available to Knead Monthly members during events.');
      } else {
        alert(`Cannot send message: ${permissions?.reason || 'Unknown reason'}`);
      }
      return;
    }

    if (pendingFile) {
      setIsUploading(true);
      const previewUrl = pendingFile.previewUrl;
      try {
        const ipfsUri = await uploadToIPFS(pendingFile.file);
        const fileMessage = `[FILE:${pendingFile.file.name}](${ipfsUri})`;
        setPendingFile(null);

        await Promise.race([
          sendMessage(fileMessage),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('File upload timeout')), 30000),
          ),
        ]);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to upload file. Please try again.');
      } finally {
        URL.revokeObjectURL(previewUrl);
        setIsUploading(false);
      }
      return;
    }

    if (!messageInput.trim() || isSending || !channelId) return;

    const messageToSend = quotedMessage 
      ? `> ${quotedMessage.sender}: ${quotedMessage.content.substring(0, 100)}${quotedMessage.content.length > 100 ? '...' : ''}\n\n${messageInput.trim()}`
      : messageInput.trim();

    try {
      setMessageInput('');
      setQuotedMessage(null);
      setFailedMessage(null);

      await Promise.race([
        sendMessage(messageToSend),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Message send timed out after 30 seconds')), 30000),
        ),
      ]);
    } catch (error: any) {
      setMessageInput(messageInput.trim());
      setFailedMessage(messageToSend);

      const msg = error.message || '';
      if (msg.includes('timed out')) {
        alert('⏱️ Message send timed out.\n\nThe Towns network may be experiencing issues. Please try again.');
      } else if (msg.includes('deadline_exceeded')) {
        alert('⏳ Network timeout. Your message was not delivered. Please try sending again.');
      } else if (msg.includes('BAD_PREV_MINIBLOCK_HASH')) {
        alert('⏳ Channel is syncing. Please wait a few seconds and try again.');
      } else if (msg.includes('QUORUM_FAILED')) {
        alert('❌ Network error - message not delivered. Please check your connection and try again.');
      } else if (msg.includes('not entitled') || msg.includes('permission')) {
        alert('❌ You do not have permission to send messages. Contact support.');
      } else {
        alert(`Failed to send: ${msg}`);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessageInput(value);

    if (value.trim()) {
      startTyping();
      setShowTypingIndicator(true);
    } else {
      stopTyping();
      setShowTypingIndicator(false);
    }
  };

  const handleInputBlur = () => {
    stopTyping();
    setShowTypingIndicator(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!permissions?.canPost) {
      if (userRole === 'freemium') {
        alert('Free Members can only view. Sign-up for Knead Monthly to participate.');
      } else {
        alert('Messaging is available to Knead Monthly members during events.');
      }
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPendingFile({ file, previewUrl });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderMessages = () => {
    // useTimeline never returns undefined — data is always [].
    // Use isLoading (SDK is syncing the stream) rather than !events.
    if (isTimelineLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
            <p className="font-georgia-pro text-gray-500">Loading messages...</p>
          </div>
        </div>
      );
    }

    // Surface SDK-level timeline errors (e.g. stream not found, auth failure)
    if (isTimelineError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500 py-8">
            <p className="font-georgia-pro text-lg">Could not load messages.</p>
            <p className="font-georgia-pro text-sm mt-2">
              There was a problem connecting to the chat stream.{' '}
              <button
                onClick={() => window.location.reload()}
                className="text-[#007AFF] underline hover:text-[#0051D5]"
              >
                Reload
              </button>
            </p>
          </div>
        </div>
      );
    }

    if (messagesWithContributorStatus.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500 py-8">
            <p className="font-georgia-pro text-lg">Messages need to sync.</p>
            <p className="font-georgia-pro text-sm mt-2">
              Syncing encryption keys. If nothing appears in 5–10 seconds, try refreshing.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="py-4">
        <div ref={topSentinelRef} style={{ height: '1px', marginTop: '20px' }} />

        {scrollbackFailed && !isLoadingMore && (
          <div className="text-center py-3 px-4">
            <p className="font-georgia-pro text-sm text-gray-500 mb-2">
              Could not load older messages. The chat network may be temporarily busy.
            </p>
            <button
              onClick={() => {
                setScrollbackFailed(false);
                loadMoreMessages();
              }}
              className="font-georgia-pro text-sm text-[#007AFF] underline hover:text-[#0051D5]"
            >
              Try again
            </button>
            <span className="font-georgia-pro text-sm text-gray-400 mx-2">or</span>
            <button
              onClick={() => window.location.reload()}
              className="font-georgia-pro text-sm text-[#007AFF] underline hover:text-[#0051D5]"
            >
              Reload page
            </button>
          </div>
        )}

        {isLoadingMore && (
          <div className="text-center py-2">
            <p className="font-georgia-pro text-xs text-gray-400">Loading older messages...</p>
          </div>
        )}

        {messagesWithContributorStatus.map((message: any) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.isOwn || false}
            streamId={channelId}
            canAwardTokens={canAwardTokens}
            canReact={canReact}
            isAdmin={isAdmin}
            channelId={channelId}
            spaceId={spaceId}
            eventId={activeEvent?.id}
            isDecrypting={message.isDecrypting}
          />
        ))}

        {showTypingIndicator && permissions?.canPost && (
          <TypingIndicator userName="You're" />
        )}

        <div ref={messagesEndRef} />
      </div>
    );
  };

  const renderDisabledMessageBanner = () => {
    if (permissions?.canPost || paymentVerified) return null;

    if ((permissions as any)?.eventPassOnly && !(permissions as any)?.hasEventPass) {
      return (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <p className="font-georgia-pro text-sm text-gray-600 text-center">
            Participating in this event is exclusive to a community-oriented group, like students or a non-profit.
          </p>
        </div>
      );
    }

    if (userRole === 'freemium') {
      return (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <p className="font-georgia-pro text-sm text-gray-600 text-center">
            Free Members can enjoy viewing for 1 hour per month.{' '}
            <button
              onClick={handleOpenPaymentModal}
              disabled={isLoadingIntent}
              className="text-[#007AFF] underline hover:text-[#0051D5] transition-colors bg-transparent border-none cursor-pointer font-georgia-pro text-sm disabled:opacity-50"
            >
              {isLoadingIntent ? 'Loading...' : 'Sign-up for Knead Monthly'}
            </button>{' '}
            to participate in events.
          </p>
        </div>
      );
    }

    if (userRole === 'participant' && !activeEvent) {
      return (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <p className="font-georgia-pro text-sm text-gray-600 text-center">
            Messaging is available to Knead Monthly members during events. Check the calendar in the top left corner to see what's happening.
          </p>
        </div>
      );
    }

    return null;
  };

  const renderChatInput = () => {
    // ✅ Allow chat input if payment verified OR has permission
    if (!permissions?.canPost && !paymentVerified) {
      return renderDisabledMessageBanner();
    }

    return (
      <div className="flex flex-col gap-2">
        {quotedMessage && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Reply className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700 font-georgia-pro">
                  Replying to {quotedMessage.sender}
                </span>
              </div>
              <p className="text-sm text-gray-700 font-georgia-pro line-clamp-2">
                {quotedMessage.content.length > 150 
                  ? `${quotedMessage.content.substring(0, 150)}...` 
                  : quotedMessage.content}
              </p>
            </div>
            <button
              onClick={() => setQuotedMessage(null)}
              className="p-1 hover:bg-blue-100 rounded-full transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-blue-600" />
            </button>
          </div>
        )}

        {pendingFile && (
          <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-2xl">
            {isImageFile(pendingFile.file.name) ? (
              <img
                src={pendingFile.previewUrl}
                alt={pendingFile.file.name}
                className="w-16 h-16 object-cover rounded-xl flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-xl flex-shrink-0">
                <span className="text-2xl">📎</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-georgia-pro font-medium text-gray-800 truncate">{pendingFile.file.name}</p>
              <p className="text-xs text-gray-500 font-georgia-pro">
                {(pendingFile.file.size / 1024 / 1024).toFixed(1)} MB · tap send to upload
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(pendingFile.previewUrl);
                setPendingFile(null);
              }}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 text-gray-500 hover:text-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            value={messageInput}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={(e) => {
              const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
              
              if (!isTouchDevice && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder={
              isUploading ? "Uploading..." :
              pendingFile ? "Add a caption or just hit send..." :
              quotedMessage ? "Type your reply..." :
              channelId ? "Type a message..." : "Loading..."
            }
            rows={1}
            className="flex-1 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 font-georgia-pro focus:ring-[#007AFF] border-gray-300 resize-none max-h-32 overflow-y-auto"
            style={{
              minHeight: '48px',
              height: 'auto',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
            }}
            disabled={isSending || isUploading || !channelId}
          />
          <button
            type="submit"
            disabled={(!messageInput.trim() && !pendingFile) || isSending || isUploading || !channelId}
            className="w-10 h-10 flex items-center justify-center bg-[#007AFF] text-white rounded-full hover:bg-[#0051D5] transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </form>
      </div>
    );
  };

  const hasVideo = activeEvent && activeEvent.videoEnabled && dailyToken && activeEvent.dailyRoomUrl && activeEvent.eventType !== 'recorded';
  const hasRecordedVideo = activeEvent && activeEvent.eventType === 'recorded' && activeEvent.muxPlaybackId;

  const stripeOptions = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: 'stripe' as const,
          variables: {
            colorPrimary: '#000000',
            colorBackground: '#ffffff',
            colorText: '#1a1a1a',
            colorDanger: '#dc2626',
            fontFamily: '"Georgia Pro", Georgia, serif',
            spacingUnit: '4px',
            borderRadius: '4px',
          },
          rules: {
            '.Label': {
              fontFamily: '"adonis-web", serif',
              fontSize: '14px',
              fontWeight: '400',
            },
            '.Input': {
              fontFamily: '"Georgia Pro", Georgia, serif',
              fontSize: '16px',
            },
          },
        },
      }
    : null;

  return (
    <>
      <DailyProvider>
        <ChatLayout>
          <PermissionDebugBanner
            permissions={permissions}
            userRole={userRole}
            activeEvent={activeEvent}
          />

          {failedMessage && (
            <RetryMessageBanner
              message={failedMessage}
              onRetry={() => handleSendMessage({ preventDefault: () => {} } as any)}
              onCancel={() => {
                setFailedMessage(null);
                setMessageInput('');
                setQuotedMessage(null);
              }}
            />
          )}

          {/* ✅ Show verifying state */}
          {isVerifying && (
            <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <p className="text-sm font-medium text-blue-700 font-georgia-pro">
                  Verifying your payment...
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col h-full bg-white">
            {hasVideo && (
              <div className="flex-shrink-0 h-[40vh] md:h-[45vh] lg:h-[50vh] bg-gray-900">
                <EventVideoStage
                  event={activeEvent}
                  currentUserAddress={activeAccount?.address || ''}
                  roomUrl={activeEvent.dailyRoomUrl}
                  token={dailyToken}
                />
              </div>
            )}

            {hasRecordedVideo && (
              <div className="flex-shrink-0 h-[40vh] md:h-[45vh] lg:h-[50vh] bg-black">
                <MuxPlayer
                  playbackId={activeEvent!.muxPlaybackId!}
                  streamType="on-demand"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            )}

            {activeEvent && !hasVideo && !hasRecordedVideo && (
              <div className="flex-shrink-0">
                <EventBanner eventTitle={activeEvent.title} timeRemaining={undefined} isLive={true} />
              </div>
            )}

            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto min-h-0"
            >
              {renderMessages()}
            </div>

            <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
              {renderChatInput()}
            </div>
          </div>
        </ChatLayout>
      </DailyProvider>

      <FreemiumBanner remainingMinutes={remainingMinutes} />

      <Dialog open={isStripeModalOpen} onOpenChange={setIsStripeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-adonis text-xl text-center">
              Subscribe to Knead Monthly
            </DialogTitle>
            <DialogDescription className="font-georgia-pro text-sm text-center text-gray-600">
              Complete your payment to get unlimited access to all Knead stories
            </DialogDescription>
          </DialogHeader>
          {clientSecret && stripeOptions && (
            <Elements stripe={stripePromise} options={stripeOptions} key={clientSecret}>
              <PaymentForm onSuccess={handlePaymentSuccess} />
            </Elements>
          )}
        </DialogContent>
      </Dialog>

      <WelcomeModal isOpen={showWelcomeModal} onClose={handleWelcomeClose} />
      
      <ContributorWelcomeModal
        isOpen={showContributorModal}
        onClose={handleContributorClose}
        userAddress={activeAccount?.address || ''}
        userId={currentUser.id}
        currentAlias={activeAccount?.address ? profileCache[activeAccount.address]?.alias : undefined}
        currentAvatar={activeAccount?.address ? profileCache[activeAccount.address]?.avatar : undefined}
      />
    </>
  );
}
