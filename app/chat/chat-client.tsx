'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAgentConnection, useSpace } from '@towns-protocol/react-sdk';
import { useActiveWallet } from 'thirdweb/react';
import { createTownsSigner } from '@/lib/towns-signer-adapter';
import { client, activeChain } from '@/thirdweb-client';
import { privateKeyToAccount } from 'thirdweb/wallets';
import type { ChatUser } from '@/types/chat';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { TOWNS_CONFIG } from '@/lib/towns-config';

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

const ConnectedChat = nextDynamic(() => import('./connected-chat'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading chat..." />,
});

// ---------------------------------------------------------------------------
// Shared UI
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Bot auto-connect
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Phase types
// ---------------------------------------------------------------------------

type Phase = 'idle' | 'signing' | 'connecting' | 'joining' | 'ready' | 'error';

const PHASE_LABELS: Record<Phase, string> = {
  idle: 'Waiting for wallet...',
  signing: 'Please sign the message...',
  connecting: 'Connecting to Towns...',
  joining: 'Joining space...',
  ready: '',
  error: 'Something went wrong.',
};

// ---------------------------------------------------------------------------
// TownsChat — owns connection flow, NO SyncAgent-dependent hooks
// ---------------------------------------------------------------------------

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
  const signerRef = useRef<any>(null);
  const agentRef = useRef<any>(null);
  const flowStartedRef = useRef(false);

  const runFlow = useCallback(async () => {
    if (flowStartedRef.current) return;
    flowStartedRef.current = true;

    try {
      const account = wallet?.getAccount();
      if (!account || !SAVED_SPACE_ID) {
        flowStartedRef.current = false;
        return;
      }

      // 1. Create signer (cached for the session)
      if (!signerRef.current) {
        setPhase('signing');
        signerRef.current = await createTownsSigner(account, client, activeChain);
      }

      // 2. Connect agent
      if (!isAgentConnected) {
        setPhase('connecting');
        const agent = await connectAgent(signerRef.current, {
          townsConfig: TOWNS_CONFIG,
        });
        if (!agent) {
          throw new Error('Agent connection failed — returned undefined');
        }
        agentRef.current = agent;
      }

      // 3. Join space — only if not already a member
      if (agentRef.current) {
        setPhase('joining');

        // Wait for persistence to load space memberships
        // SDK loads from IndexedDB after connect() — typically ~0.5ms
        let alreadyMember = false;
        for (let i = 0; i < 5; i++) {
          const spaceIds = agentRef.current.spaces.value?.data?.spaceIds || [];
          alreadyMember = spaceIds.includes(SAVED_SPACE_ID);
          if (alreadyMember) break;
          await new Promise((r) => setTimeout(r, 100)); // 100ms × 5 = 500ms max
        }

        if (alreadyMember) {
          console.log('✅ Already a member of space, skipping joinSpace transaction');
        } else {
          try {
            // First attempt: skip mint — covers the case where persistence
            // hadn't loaded yet but user IS already a member on-chain
            await agentRef.current.spaces.joinSpace(
              SAVED_SPACE_ID,
              signerRef.current,
              { skipMintMembership: true },
            );
          } catch (e: any) {
            const msg = (e.message || '').toLowerCase();
            const alreadyJoined =
              msg.includes('already a member') || msg.includes('already joined');
            if (alreadyJoined) {
              console.log('✅ Already a member (caught from joinSpace)');
            } else if (msg.includes('not a member') || msg.includes('no membership')) {
              // Genuinely new user — call again WITH mint
              console.log('🆕 New user, minting membership...');
              await agentRef.current.spaces.joinSpace(
                SAVED_SPACE_ID,
                signerRef.current,
              );
            } else {
              throw e;
            }
          }
        }
      }

      setPhase('ready');

      if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
        window.KEY_SHARER_SPACE_JOINED = true;
        window.KEY_SHARER_CONNECTED = true;
      }
    } catch (e: any) {
      setPhase('error');
      setErrorMsg(friendlyError(e));
      flowStartedRef.current = false;

      if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
        window.KEY_SHARER_ERROR = e.message;
        window.KEY_SHARER_CONNECTED = false;
      }
    }
  }, [wallet, isAgentConnected, connectAgent]);

  // ---- Trigger the flow when wallet is available ----
  useEffect(() => {
    if (wallet && (phase === 'idle' || phase === 'joining')) {
      runFlow();
    }
  }, [wallet, phase, runFlow]);

  // ---- Render ----
  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <p className="font-georgia-pro text-red-500 mb-4">{errorMsg}</p>
          <button
            onClick={() => {
              setPhase('idle');
              setErrorMsg('');
              flowStartedRef.current = false;
            }}
            className="px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (phase !== 'ready' || !isAgentConnected) {
    return (
      <LoadingSpinner
        message={
          PHASE_LABELS[phase] +
          (phase === 'signing' ? '\nCheck your wallet to continue' : '')
        }
      />
    );
  }

  return <TownsChatReady wallet={wallet} />;
}

// ---------------------------------------------------------------------------
// TownsChatReady — only mounts when SyncAgent exists in context
// ---------------------------------------------------------------------------

function TownsChatReady({ wallet }: { wallet: ReturnType<typeof useActiveWallet> }) {
  const { data: space, isLoading: isSpaceLoading } = useSpace(SAVED_SPACE_ID || '');

  const currentUser: ChatUser | null = useMemo(() => {
    const address = wallet?.getAccount()?.address;
    if (!address) return null;
    return {
      id: address,
      address,
      displayName: `${address.slice(0, 6)}...${address.slice(-4)}`,
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
    <div className="w-full h-screen">
      <ConnectedChat
        currentUser={currentUser}
        spaceId={SAVED_SPACE_ID!}
        defaultChannelId={channelId}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

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

  // Bot mode
  if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
    if (!botWallet || !isAgentConnected) {
      return <LoadingSpinner message="Bot Mode: Connecting..." />;
    }
    return <TownsChat />;
  }

  // Normal user — show connect button
  if (!wallet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-4xl mb-4">Connect Your Wallet</h1>
          <ThirdWebConnectButton
            theme="light"
            size="wide"
            className="inline-block"
          />
        </div>
      </div>
    );
  }

  return <TownsChat />;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function friendlyError(error: any): string {
  const msg = error.message?.toLowerCase() || '';
  if (msg.includes('429') || msg.includes('bandwidth'))
    return 'Network is busy — please try again in a moment.';
  if (msg.includes('cannot_connect') || msg.includes('unavailable') ||
      msg.includes('downstream_network') || msg.includes('connection refused'))
    return 'The Towns network is experiencing issues. Please try again shortly.';
  if (msg.includes('unimplemented') || msg.includes('501'))
    return 'The Towns network is undergoing maintenance. Please try again later.';
  if (msg.includes('quorum_failed'))
    return 'Not enough network nodes are available right now. Please try again in a few minutes.';
  if (msg.includes('user rejected') || msg.includes('denied'))
    return 'Wallet signature was cancelled.';
  if (msg.includes('returned undefined'))
    return 'Agent connection failed. Please retry.';
  if (msg.includes('transaction failed after retries'))
    return 'The Towns network is congested. Please try again shortly.';
  return error.message || 'An unexpected error occurred.';
}
