'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAgentConnection, useSpace, useJoinSpace, useUserSpaces } from '@towns-protocol/react-sdk';
import { useActiveWallet } from 'thirdweb/react';
import { createTownsSigner } from '@/lib/towns-signer-adapter';
import { client, activeChain } from '@/thirdweb-client';
import { privateKeyToAccount } from 'thirdweb/wallets';
import type { ChatUser } from '@/types/chat';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { TOWNS_CONFIG } from '@/lib/towns-config';
import { formatAddressForDisplay } from '@/lib/utils/transformers';

declare global {
  interface Window {
    KEY_SHARER_PRIVATE_KEY?: string;
    KEY_SHARER_AUTO_MODE?: boolean;
    KEY_SHARER_CONNECTED?: boolean;
    KEY_SHARER_ATTEMPTED?: boolean;
    KEY_SHARER_ERROR?: string;
    KEY_SHARER_SPACE_JOINED?: boolean;
    KEY_SHARER_CHANNEL_SYNCED?: boolean;
    KEY_SHARER_CHANNEL_ID?: string;
  }
}

const SAVED_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
const JOIN_TIMEOUT_MS = 120000; // 120 seconds for mints

const ConnectedChat = nextDynamic(() => import('./connected-chat'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading chat..." />,
});

interface ProgressiveLoaderProps {
  steps: string[];
  currentStep: number;
}

function ProgressiveLoader({ steps, currentStep }: ProgressiveLoaderProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center max-w-md px-4">
        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                i <= currentStep
                  ? 'bg-black scale-100'
                  : 'bg-gray-300 scale-75'
              }`}
              style={{
                animation: i <= currentStep ? 'pulse 1.5s ease-in-out infinite' : 'none',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>

        <div className="space-y-2">
          {steps.map((step, i) => (
            <p
              key={i}
              className={`font-georgia-pro text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                i === currentStep
                  ? 'text-black font-medium'
                  : i < currentStep
                  ? 'text-gray-400'
                  : 'text-gray-300'
              }`}
            >
              <span>
                {i < currentStep ? '✓ ' : i === currentStep ? '→ ' : ''}
                {step}
              </span>
              {step === 'Kneading the dough' && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 1200 1200"
                  className="inline-block"
                  fill="currentColor"
                >
                  <path d="m546.79 153.24c-49.5 15.516-70.922 28.828-195.42 81.562-86.719 36.75-157.36 67.219-203.29 87.094-0.42188 0.14062-0.5625 0.28125-0.5625 0.28125-13.031 7.2188-32.578 20.156-50.062 41.906-39.703 49.359-38.484 106.59-36.844 127.08 4.7344 58.172 36.047 98.25 54.75 117.47 7.7344 7.9688 12 18.609 12 29.719v258.14c0 42.328 30.047 78.469 71.531 86.109l430.26 79.969c5.2969 0.9375 10.734 1.5 16.031 1.5h0.14062c14.672 0 28.828-3.6562 41.344-10.453l9.0938-5.7188 329.34-204.84 17.812-11.156 2.25-1.6406c17.766-15.422 27.797-36.469 27.797-59.016v-235.08c0-3.75 1.6875-7.3125 4.4531-9.7969 52.922-47.812 62.531-86.531 62.484-111.89-0.46875-152.86-354.24-336.1-593.21-261.19zm131.68 836.16c0 20.812-18.891 36.469-39.328 32.625l-430.26-79.828c-15.656-3-27.094-16.594-27.094-32.625v-276.56c0-16.734-6.7969-33.188-19.453-44.062-30.047-25.688-47.484-56.203-47.484-88.969 0-91.547 48.422-148.97 216.28-142.97 30.188 1.0781 58.219 3.1406 84.328 5.8594 274.13 29.109 329.86 145.69 329.86 229.36 0 32.766-17.391 63.234-47.484 88.969-12.797 10.875-19.453 27.328-19.453 44.062v264.19z" />
                </svg>
              )}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4" />
        {message && (
          <p className="font-georgia-pro text-sm text-gray-600">{message}</p>
        )}
      </div>
    </div>
  );
}

function useBotAutoConnect() {
  const { connect: connectAgent, isAgentConnected } = useAgentConnection();
  const wallet = useActiveWallet();
  const [botWallet, setBotWallet] = useState<any>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !window.KEY_SHARER_AUTO_MODE ||
      !window.KEY_SHARER_PRIVATE_KEY ||
      initRef.current
    )
      return;

    initRef.current = true;

    (async () => {
      try {
        const account = privateKeyToAccount({
          client,
          privateKey: window.KEY_SHARER_PRIVATE_KEY!,
        });
        delete window.KEY_SHARER_PRIVATE_KEY;
        setBotWallet({
          getAccount: () => account,
          getChain: () => activeChain,
          disconnect: async () => {},
          switchChain: async () => {},
        });
      } catch (e: any) {
        window.KEY_SHARER_ERROR = `Wallet creation failed: ${e.message}`;
        window.KEY_SHARER_CONNECTED = false;
      }
    })();
  }, []);

  useEffect(() => {
    if (!botWallet || isAgentConnected || !window.KEY_SHARER_AUTO_MODE) return;

    (async () => {
      try {
        const signer = await createTownsSigner(
          botWallet.getAccount()!,
          client,
          activeChain,
        );
        const agent = await connectAgent(signer, { townsConfig: TOWNS_CONFIG });
        if (!agent) {
          window.KEY_SHARER_ERROR = 'Agent connection returned undefined';
          window.KEY_SHARER_CONNECTED = false;
        }
      } catch (e: any) {
        window.KEY_SHARER_ERROR = `Agent connection failed: ${e.message}`;
        window.KEY_SHARER_CONNECTED = false;
      }
    })();
  }, [botWallet, isAgentConnected, connectAgent]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.KEY_SHARER_AUTO_MODE) return;
    const active = wallet || botWallet;
    window.KEY_SHARER_ATTEMPTED = true;
    window.KEY_SHARER_CONNECTED = !!(active && isAgentConnected);
    if (window.KEY_SHARER_CONNECTED) delete window.KEY_SHARER_ERROR;
  }, [wallet, botWallet, isAgentConnected]);

  return { botWallet };
}

type Phase = 'idle' | 'signing' | 'connecting' | 'joining' | 'ready' | 'error';

const PHASE_LABELS: Record<Phase, string> = {
  idle: 'Waiting for wallet...',
  signing: 'Please sign the message...',
  connecting: 'Connecting to Towns...',
  joining: 'Joining space...',
  ready: '',
  error: 'Something went wrong.',
};

const NEW_USER_STEPS = [
  'Connecting to network',
  'Reaching the nodes',
  'Connected to nodes',
  'Minting membership',
  'Kneading the dough',
];

// Timeout wrapper
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Network error detection (excluding timeouts)
function isNetworkError(error: any): boolean {
  const msg = (error?.message || '').toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('cannot_connect') ||
    msg.includes('unavailable') ||
    msg.includes('connection refused') ||
    msg.includes('failed to fetch')
  );
}

// Separate timeout check
function isTimeout(error: any): boolean {
  const msg = (error?.message || '').toLowerCase();
  return msg.includes('timed out') || msg.includes('timeout');
}

// Check if already a member
function isAlreadyMember(error: any): boolean {
  const msg = (error?.message || '').toLowerCase();
  return msg.includes('already a member') || msg.includes('already joined');
}

// Outer component - doesn't call any SDK hooks that require SyncAgent
function TownsChat() {
  const wallet = useActiveWallet();
  const { connect: connectAgent, isAgentConnected } = useAgentConnection();

  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
      return 'joining';
    }
    return 'idle';
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [showProgressiveLoader, setShowProgressiveLoader] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  
  // ✅ NEW: Add retry trigger state
  const [retryTrigger, setRetryTrigger] = useState(0);

  const signerRef = useRef<any>(null);
  const connectAttemptedRef = useRef(false);

  // Step 1: Handle wallet connection and agent setup
  useEffect(() => {
    const setupConnection = async () => {
      if (connectAttemptedRef.current || !wallet || isAgentConnected) return;
      
      const account = wallet.getAccount();
      if (!SAVED_SPACE_ID) return;

      connectAttemptedRef.current = true;

      try {
        // Create signer
        if (!signerRef.current) {
          setPhase('signing');
          signerRef.current = await createTownsSigner(account, client, activeChain);
        }

        // Connect agent
        setPhase('connecting');
        await connectAgent(signerRef.current, { townsConfig: TOWNS_CONFIG });
        
        // Move to joining phase
        setPhase('joining');
        
      } catch (e: any) {
        console.error('❌ Connection error:', e);
        setPhase('error');
        setErrorMsg(friendlyError(e));
        connectAttemptedRef.current = false;

        if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
          window.KEY_SHARER_ERROR = e.message;
          window.KEY_SHARER_CONNECTED = false;
        }
      }
    };

    setupConnection();
  }, [wallet, isAgentConnected, connectAgent]);

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <p className="font-georgia-pro text-red-500 mb-4">{errorMsg}</p>
          <button
            onClick={() => {
              setPhase('idle');
              setErrorMsg('');
              setShowProgressiveLoader(false);
              setLoadingStep(0);
              connectAttemptedRef.current = false;
              setRetryTrigger(prev => prev + 1); // ✅ Trigger retry in child component
            }}
            className="px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Only render join flow when agent is connected
  if (!isAgentConnected || phase === 'signing' || phase === 'connecting') {
    return (
      <LoadingSpinner
        message={
          PHASE_LABELS[phase] +
          (phase === 'signing' ? '\nCheck your wallet to continue' : '')
        }
      />
    );
  }

  return (
    <TownsChatJoinFlow
      wallet={wallet}
      signerRef={signerRef}
      phase={phase}
      setPhase={setPhase}
      showProgressiveLoader={showProgressiveLoader}
      setShowProgressiveLoader={setShowProgressiveLoader}
      loadingStep={loadingStep}
      setLoadingStep={setLoadingStep}
      setErrorMsg={setErrorMsg}
      retryTrigger={retryTrigger} // ✅ Pass retry trigger
    />
  );
}

// Inner component - only mounts when agent is connected, safe to use useJoinSpace
function TownsChatJoinFlow({
  wallet,
  signerRef,
  phase,
  setPhase,
  showProgressiveLoader,
  setShowProgressiveLoader,
  loadingStep,
  setLoadingStep,
  setErrorMsg,
  retryTrigger, // ✅ Receive retry trigger
}: {
  wallet: ReturnType<typeof useActiveWallet>;
  signerRef: React.MutableRefObject<any>;
  phase: Phase;
  setPhase: (phase: Phase) => void;
  showProgressiveLoader: boolean;
  setShowProgressiveLoader: (show: boolean) => void;
  loadingStep: number;
  setLoadingStep: (step: number) => void;
  setErrorMsg: (msg: string) => void;
  retryTrigger: number; // ✅ NEW
}) {
  const { joinSpace } = useJoinSpace();
  const { spaceIds, isLoaded } = useUserSpaces();
  const joinAttemptedRef = useRef(false);

  // ✅ Reset join attempt when retry is triggered
  useEffect(() => {
    if (retryTrigger > 0) {
      console.log('🔄 Retry triggered, resetting join attempt');
      joinAttemptedRef.current = false;
    }
  }, [retryTrigger]);

  // Step 2: Handle space joining
  useEffect(() => {
    const handleJoinSpace = async () => {
      if (
        joinAttemptedRef.current || 
        !signerRef.current || 
        !SAVED_SPACE_ID ||
        !isLoaded
      ) {
        return;
      }

      const account = wallet?.getAccount();
      if (!account) return;

      console.log('✅ Agent userId confirmed (user spaces loaded), joining space...');
      console.log('📊 User currently in spaces:', spaceIds);
      setPhase('joining');
      joinAttemptedRef.current = true;

      // Check if user is already a member
      const isAlreadyInSpace = spaceIds.includes(SAVED_SPACE_ID);
      
      if (isAlreadyInSpace) {
        console.log('✅ User already in space, skipping join process');
        setPhase('ready');
        
        if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
          window.KEY_SHARER_SPACE_JOINED = true;
          window.KEY_SHARER_CONNECTED = true;
        }
        return;
      }

      // User is NOT in the space - need to join (mint membership)
      console.log('🆕 User not in space, starting join process...');

      try {
        // Show minting flow for new users
        setShowProgressiveLoader(true);
        
        // Animate through steps
        for (let step = 0; step <= 3; step++) {
          setLoadingStep(step);
          await new Promise((r) => setTimeout(r, 300));
        }

        console.log('🔄 Minting membership NFT (this may take 1-2 minutes)...');

        // ✅ NO RETRY - Single attempt with 120s timeout to avoid duplicate mints
        await withTimeout(
          joinSpace(SAVED_SPACE_ID, signerRef.current),
          JOIN_TIMEOUT_MS
        );

        // Freemium mint in parallel (non-blocking, API handles duplicate check)
        fetch('/api/mint-freemium', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: account.address }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              if (data.alreadyOwned) {
                console.log('✅ User already has freemium NFT');
              } else {
                console.log('✅ Freemium NFT minted');
              }
            }
          })
          .catch((err) => {
            console.warn('Freemium NFT check/mint failed (non-critical):', err);
          });

        console.log('✅ Membership minted successfully');

        setLoadingStep(4);
        await new Promise((r) => setTimeout(r, 400));
        
      } catch (joinError: any) {
        console.error('❌ Join/mint failed:', joinError);
        joinAttemptedRef.current = false;
        
        // ✅ IMPROVED: Better error message for timeouts
        if (isTimeout(joinError)) {
          setErrorMsg(
            'The membership mint is taking longer than expected. The transaction may still complete on the blockchain.\n\n' +
            'Please wait 1-2 minutes, then refresh the page. If you still can\'t access chat, click Retry below.'
          );
        } else {
          setErrorMsg(friendlyError(joinError));
        }
        
        setPhase('error');

        if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
          window.KEY_SHARER_ERROR = joinError.message;
          window.KEY_SHARER_CONNECTED = false;
        }
        return;
      }

      // Success
      setPhase('ready');

      if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
        window.KEY_SHARER_SPACE_JOINED = true;
        window.KEY_SHARER_CONNECTED = true;
      }
    };

    handleJoinSpace();
  }, [isLoaded, spaceIds, wallet, joinSpace, signerRef, setPhase, setErrorMsg, setShowProgressiveLoader, setLoadingStep, retryTrigger]); // ✅ Add retryTrigger to deps

  if (phase !== 'ready') {
    if (showProgressiveLoader) {
      return <ProgressiveLoader steps={NEW_USER_STEPS} currentStep={loadingStep} />;
    }

    return <LoadingSpinner message={PHASE_LABELS[phase]} />;
  }

  return <TownsChatReady wallet={wallet} />;
}

function TownsChatReady({
  wallet,
}: {
  wallet: ReturnType<typeof useActiveWallet>;
}) {
  const { isAgentConnected } = useAgentConnection();
  
  if (!isAgentConnected) {
    return <LoadingSpinner message="Finalizing connection..." />;
  }
  
  return <TownsChatReadyInner wallet={wallet} />;
}

function TownsChatReadyInner({
  wallet,
}: {
  wallet: ReturnType<typeof useActiveWallet>;
}) {
  const { data: space, isLoading: isSpaceLoading } = useSpace(SAVED_SPACE_ID || '');

  const currentUser: ChatUser | null = useMemo(() => {
    const address = wallet?.getAccount()?.address;
    if (!address) return null;
    return {
      id: address,
      address,
      displayName: formatAddressForDisplay(address),
      role: 'viewer',
      membershipTier: 'freemium',
      isBanned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }, [wallet]);

  if (isSpaceLoading || !space) {
    return <LoadingSpinner message="Loading space..." />;
  }

  if (!space.initialized) {
    return <LoadingSpinner message="Syncing with chat network..." />;
  }

  const channelId = space.channelIds?.[0];
  if (!channelId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="font-georgia-pro text-red-500">No channels found</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoadingSpinner message="Resolving user..." />;
  }

  return (
    <div className="w-full h-screen relative">
      <ConnectedChat
        currentUser={currentUser}
        spaceId={SAVED_SPACE_ID!}
        defaultChannelId={channelId}
      />
    </div>
  );
}

export default function ChatTestClient() {
  const [isMounted, setIsMounted] = useState(false);
  const wallet = useActiveWallet();
  const { isAgentConnected } = useAgentConnection();
  const { botWallet } = useBotAutoConnect();

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (localStorage.getItem('exportKeyIntent') !== '1') return;
    if (!wallet || !isAgentConnected) return;
    localStorage.removeItem('exportKeyIntent');
    setTimeout(() => {
      alert(
        '✅ Authentication successful!\n\n' +
          "To export your private key:\n" +
          "1. Click the 'K' logo (top left)\n" +
          "2. Click 'Export Private Key'\n" +
          '3. Follow the instructions',
      );
    }, 1500);
  }, [wallet, isAgentConnected]);

  if (!isMounted) return <LoadingSpinner />;

  if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
    if (!botWallet || !isAgentConnected) {
      return <LoadingSpinner message="Bot Mode: Connecting..." />;
    }
    return <TownsChat />;
  }

  if (!wallet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-3xl px-8">
          <div className="mb-12 animate-fade-in-up">
            <h1 className="font-adonis text-5xl md:text-6xl mb-6">
              Welcome to our chat
            </h1>
            <p className="text-xl md:text-2xl font-adonis italic text-gray-700 mb-8">
              Our home for community, conversation, and creativity.
            </p>
          </div>

          <div className="mb-8 animate-fade-in-up-delay">
            <p className="font-georgia-pro text-base md:text-lg text-gray-800">
             If this is your first time joining, click the button below to sign-up:
            </p>
            <p className="font-georgia-pro italic text-sm text-gray-500 mt-2">
              (Note: Onboarding can take 1-2 minutes for new users)
            </p>
          </div>

          <div className="animate-fade-in-up-delay-3">
            <ThirdWebConnectButton
              theme="light"
              size="wide"
              className="inline-block"
            />
          </div>
        </div>
      </div>
    );
  }

  return <TownsChat />;
}

function friendlyError(error: any): string {
  const msg = error.message?.toLowerCase() || '';
  if (msg.includes('timed out') || msg.includes('timeout'))
    return 'The network is taking longer than expected. This can happen when the blockchain is busy. Please try again in a moment.';
  if (msg.includes('429') || msg.includes('bandwidth'))
    return 'Network is busy — please try again in a moment.';
  if (
    msg.includes('cannot_connect') ||
    msg.includes('unavailable') ||
    msg.includes('downstream_network') ||
    msg.includes('connection refused')
  )
    return 'The Towns network is experiencing issues. Please try again shortly.';
  if (msg.includes('unimplemented') || msg.includes('501'))
    return 'The Towns network is undergoing maintenance. Please try again later.';
  if (msg.includes('quorum_failed'))
    return 'Not enough network nodes are available right now. Please try again in a few minutes.';
  if (msg.includes('user rejected') || msg.includes('denied'))
    return 'Wallet signature was cancelled.';
  if (msg.includes('client is not defined') || msg.includes('loginwithretries'))
    return 'Connection initializing. Please try again in a moment.';
  if (msg.includes('bad_prev_miniblock_hash'))
    return 'The chat network is syncing. Please wait a moment and try again.';
  return error.message || 'An unexpected error occurred.';
}
