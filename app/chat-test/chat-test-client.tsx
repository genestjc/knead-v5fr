'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAgentConnection, useJoinSpace, useSpace, useSyncAgent } from '@towns-protocol/react-sdk';
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
  loading: () => <LoadingSpinner />,
});

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
      <p className="font-georgia-pro text-gray-600">Loading...</p>
    </div>
  </div>
);

function useBotAutoConnect() {
  const { connect: connectAgent, isAgentConnected } = useAgentConnection();
  const wallet = useActiveWallet();
  const [botWallet, setBotWallet] = useState<any>(null);
  const [botInitialized, setBotInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.KEY_SHARER_AUTO_MODE || !window.KEY_SHARER_PRIVATE_KEY) {
      return;
    }

    if (botInitialized) {
      return;
    }

    const initBotWallet = async () => {
      try {
        const account = privateKeyToAccount({
          client,
          privateKey: window.KEY_SHARER_PRIVATE_KEY!,
        });

        const mockWallet = {
          getAccount: () => account,
          getChain: () => activeChain,
          disconnect: async () => {},
          switchChain: async () => {},
        };

        setBotWallet(mockWallet);
        delete window.KEY_SHARER_PRIVATE_KEY;
        setBotInitialized(true);
      } catch (error: any) {
        console.error('Bot wallet creation failed:', error);
        window.KEY_SHARER_ERROR = `Wallet creation failed: ${error.message}`;
        window.KEY_SHARER_CONNECTED = false;
        setBotInitialized(true);
      }
    };

    initBotWallet();
  }, [botInitialized]);

  useEffect(() => {
    if (!botWallet || isAgentConnected) {
      return;
    }

    if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
      const initAgent = async () => {
        try {
          const signer = await createTownsSigner(
            botWallet.getAccount()!,
            client,
            activeChain
          );

          await connectAgent(signer, {
            townsConfig: TOWNS_CONFIG,
          });
        } catch (error: any) {
          console.error('Bot agent connection failed:', error);
          window.KEY_SHARER_ERROR = `Agent connection failed: ${error.message}`;
          window.KEY_SHARER_CONNECTED = false;
        }
      };

      initAgent();
    }
  }, [botWallet, isAgentConnected, connectAgent]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.KEY_SHARER_AUTO_MODE) {
      return;
    }

    const activeWallet = wallet || botWallet;
    if (activeWallet && isAgentConnected) {
      window.KEY_SHARER_CONNECTED = true;
      window.KEY_SHARER_ATTEMPTED = true;
      delete window.KEY_SHARER_ERROR;
    } else {
      window.KEY_SHARER_ATTEMPTED = true;
      window.KEY_SHARER_CONNECTED = false;
    }
  }, [wallet, botWallet, isAgentConnected]);

  return { botWallet };
}

function SetupFlow({ signerRef }: { signerRef?: { current: any } }) {
  const wallet = useActiveWallet();
  const { connect: connectAgent, isAgentConnected } = useAgentConnection();
  
  let syncAgent;
  try {
    syncAgent = useSyncAgent();
  } catch {
    syncAgent = null;
  }
  
  const [setupComplete, setSetupComplete] = useState(false);
  const [setupStep, setSetupStep] = useState("Connecting...");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (syncAgent && !setupComplete) {
      setSetupComplete(true);
      return;
    }

    if (!wallet || isAgentConnected || setupComplete || isConnecting) return;

    const runSetup = async () => {
      setIsConnecting(true);
      try {
        const account = wallet.getAccount();
        if (!account) {
          setIsConnecting(false);
          return;
        }

        setSetupStep("Please sign the message...");

        const signer = await createTownsSigner(account, client, activeChain);

        if (signerRef) {
          signerRef.current = signer;
        }

        await connectAgent(signer, {
          townsConfig: TOWNS_CONFIG,
        });

        setSetupComplete(true);

      } catch (error: any) {
        console.error('Setup failed:', error);
        setSetupStep("Setup failed - please refresh");
        
        if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
          window.KEY_SHARER_ERROR = error.message;
          window.KEY_SHARER_CONNECTED = false;
        }
        
        alert(`Setup failed: ${error.message}\n\nPlease refresh the page.`);
      } finally {
        setIsConnecting(false);
      }
    };

    runSetup();
  }, [wallet, isAgentConnected, syncAgent, setupComplete, isConnecting, connectAgent, signerRef]);

  if (syncAgent) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center max-w-md px-4">
        <h2 className="font-adonis text-3xl mb-4">Connecting to Chat</h2>
        <LoadingSpinner />
        <p className="font-georgia-pro text-sm text-gray-600 mt-4">
          {setupStep}
        </p>
        {setupStep.includes("sign the message") && (
          <p className="font-georgia-pro text-xs text-gray-400 mt-2">
            Check your wallet to continue
          </p>
        )}
      </div>
    </div>
  );
}

function TownsChat({ signerRef }: { signerRef?: { current: any } }) {
  const [spaceId] = useState<string | null>(SAVED_SPACE_ID || null);
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinAttempt, setJoinAttempt] = useState(0);
  const [loadingStep, setLoadingStep] = useState<string>('Initializing...');

  const wallet = useActiveWallet();
  const { isAgentConnected } = useAgentConnection();
  const { joinSpace } = useJoinSpace();
  const { data: space, isLoading: isSpaceLoading } = useSpace(spaceId || '');

  let syncAgent;
  try {
    syncAgent = useSyncAgent();
  } catch {
    syncAgent = null;
  }

  const currentUser: ChatUser | null = useMemo(() => {
    const address = wallet?.getAccount()?.address;
    if (!address) return null;

    return {
      id: address,
      address: address,
      displayName: `${address.slice(0, 6)}...${address.slice(-4)}`,
      role: 'viewer',
      membershipTier: 'freemium',
      isBanned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }, [wallet]);

  const joinWithRetry = async (
    spaceId: string,
    signer: any,
    maxRetries = 3,
    skipMintMembership = false
  ) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          setLoadingStep(`Network busy, retrying in ${delay/1000}s...`);
          await new Promise(r => setTimeout(r, delay));
        }

        setJoinAttempt(attempt + 1);
        setLoadingStep(`Joining space (attempt ${attempt + 1}/${maxRetries})...`);

        await joinSpace(spaceId, signer, { skipMintMembership });
        return;

      } catch (error: any) {
        const errorMsg = error.message?.toLowerCase() || '';
        
        if (errorMsg.includes('already a member') || 
            errorMsg.includes('already joined')) {
          return;
        }

        const isTransient =
          errorMsg.includes('cannot_connect') ||
          errorMsg.includes('429') ||
          errorMsg.includes('bandwidth limit') ||
          errorMsg.includes('too many requests') ||
          errorMsg.includes('failed_precondition') ||
          errorMsg.includes('deadline_exceeded') ||
          errorMsg.includes('unavailable') ||
          errorMsg.includes('timeout');

        if (!isTransient) {
          throw error;
        }

        if (attempt < maxRetries - 1) {
          continue;
        }

        throw error;
      }
    }

    throw new Error('Failed to join after all retries');
  };

  useEffect(() => {
    if (!syncAgent) {
      return;
    }

    if (hasJoined || isJoining || !wallet || !SAVED_SPACE_ID) return;

    const joinSpaceNow = async () => {
      setIsJoining(true);
      try {
        const account = wallet.getAccount();
        if (!account) {
          setIsJoining(false);
          return;
        }

        setLoadingStep('Preparing to join space...');

        let signer = signerRef?.current;
        if (!signer) {
          setLoadingStep('Creating signer...');
          signer = await createTownsSigner(account, client, activeChain);
          if (signerRef) {
            signerRef.current = signer;
          }
        }

        setLoadingStep('Checking membership...');

        try {
          await joinSpace(SAVED_SPACE_ID, signer, { skipMintMembership: true });
          
          setHasJoined(true);
          setLoadingStep('Space joined successfully!');
          
          if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
            window.KEY_SHARER_SPACE_JOINED = true;
          }
          
          return;
          
        } catch (error: any) {
          const errorMsg = error.message?.toLowerCase() || '';
          
          const needsMembership = 
            errorMsg.includes('not a member') || 
            errorMsg.includes('not entitled') ||
            errorMsg.includes('no membership') ||
            errorMsg.includes('must mint') ||
            errorMsg.includes('must be a member');
          
          if (needsMembership) {
            setLoadingStep('Minting membership NFT (one-time)...');
            
            await joinWithRetry(SAVED_SPACE_ID, signer, 3, false);
            
            setHasJoined(true);
            setLoadingStep('Space joined successfully!');
            
            if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
              window.KEY_SHARER_SPACE_JOINED = true;
            }
            
          } else {
            throw error;
          }
        }

      } catch (error: any) {
        console.error('Join failed:', error);

        let errorMessage = 'Failed to join chat. ';
        if (error.message?.includes('429') || error.message?.includes('Bandwidth limit')) {
          errorMessage += 'Network is busy, please try again.';
        } else if (error.message?.includes('CANNOT_CONNECT')) {
          errorMessage += 'Cannot connect to network.';
        } else {
          errorMessage += error.message;
        }

        setLoadingStep('Join failed');
        alert(errorMessage);
      } finally {
        setIsJoining(false);
        setJoinAttempt(0);
        setLoadingStep('Initializing...');
      }
    };

    joinSpaceNow();
  }, [syncAgent, wallet, hasJoined, isJoining, joinSpace, signerRef, isAgentConnected]);

  if (!syncAgent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <LoadingSpinner />
          <p className="font-georgia-pro text-sm text-gray-500 mt-4">
            {!isAgentConnected ? 'Connecting to Towns...' : 'Initializing sync...'}
          </p>
        </div>
      </div>
    );
  }

  if (isSpaceLoading || isJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <LoadingSpinner />
          <p className="font-georgia-pro text-sm text-gray-500 mt-4">
            {loadingStep}
          </p>
          {joinAttempt > 1 && (
            <p className="font-georgia-pro text-xs text-gray-400 mt-2">
              Retry {joinAttempt}/3
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="font-georgia-pro text-red-500">Space not found</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!space.initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <LoadingSpinner />
          <p className="font-georgia-pro text-sm text-gray-500 mt-4">
            Syncing with chat network...
          </p>
        </div>
      </div>
    );
  }

  const channelId = space.channelIds?.[0];
  if (!channelId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="font-georgia-pro text-red-500">No channels found</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (hasJoined && currentUser) {
    return (
      <div className="w-full h-screen">
        <ConnectedChat
          currentUser={currentUser}
          spaceId={spaceId!}
          defaultChannelId={channelId}
        />
      </div>
    );
  }

  return <LoadingSpinner />;
}

export default function ChatTestClient() {
  const [isMounted, setIsMounted] = useState(false);
  const wallet = useActiveWallet();
  const { isAgentConnected } = useAgentConnection();
  const { botWallet } = useBotAutoConnect();

  const signerRef = useRef<any>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const hasExportIntent = localStorage.getItem("exportKeyIntent") === "1";
    if (hasExportIntent && wallet && isAgentConnected) {
      localStorage.removeItem("exportKeyIntent");
      setTimeout(() => {
        alert(
          "✅ Authentication successful!\n\n" +
          "To export your private key:\n" +
          "1. Click the 'K' logo (top left)\n" +
          "2. Click 'Export Private Key'\n" +
          "3. Follow the instructions"
        );
      }, 1500);
    }
  }, [wallet, isAgentConnected]);

  if (!isMounted) return <LoadingSpinner />;

  if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
    if (!botWallet) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center max-w-md">
            <LoadingSpinner />
            <p className="font-georgia-pro text-sm text-gray-600 mt-4">
              Bot Mode: Connecting...
            </p>
          </div>
        </div>
      );
    }

    if (!isAgentConnected) {
      return <SetupFlow signerRef={signerRef} />;
    }

    return <TownsChat signerRef={signerRef} />;
  }

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

  if (!isAgentConnected) {
    return <SetupFlow signerRef={signerRef} />;
  }

  return <TownsChat signerRef={signerRef} />;
}
