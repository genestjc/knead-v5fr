'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAgentConnection, useJoinSpace, useSpace, useSyncAgent, useTownsSync } from '@towns-protocol/react-sdk';
import { signAndConnect, connectTowns } from '@towns-protocol/react-sdk';
import { useActiveWallet } from 'thirdweb/react';
import { createTownsSigner } from '@/lib/towns-signer-adapter';
import { client, activeChain } from '@/thirdweb-client';
import { privateKeyToAccount } from 'thirdweb/wallets';
import type { ChatUser } from '@/types/chat';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { TOWNS_CONFIG } from '@/lib/towns-config';
import { saveSignerContext, getSignerContext, clearSignerContext } from '@/lib/towns-context-storage';

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
        console.log('🤖 Bot Mode: Creating account from private key...');
        const account = privateKeyToAccount({
          client,
          privateKey: window.KEY_SHARER_PRIVATE_KEY!,
        });
        console.log('✅ Bot account created:', account.address);

        const mockWallet = {
          getAccount: () => account,
          getChain: () => activeChain,
          disconnect: async () => {},
          switchChain: async () => {},
        };

        setBotWallet(mockWallet);
        delete window.KEY_SHARER_PRIVATE_KEY;
        console.log('🧹 Private key removed from browser memory');
        setBotInitialized(true);
      } catch (error: any) {
        console.error('❌ Bot wallet creation failed:', error);
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
          console.log('🤖 Bot Mode: Connecting Towns agent...');
          const signer = await createTownsSigner(
            botWallet.getAccount()!,
            client,
            activeChain
          );

          await connectAgent(signer, {
            townsConfig: TOWNS_CONFIG,
            onTokenExpired: () => console.log('🔄 Token expired')
          });

          console.log('✅ Bot Towns agent connected');
        } catch (error: any) {
          console.error('❌ Bot agent connection failed:', error);
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
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ BOT SUCCESSFULLY CONNECTED');
      console.log(`   Wallet: ${activeWallet.getAccount?.()?.address || 'unknown'}`);
      console.log(`   Time: ${new Date().toISOString()}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
  const { isAgentConnected } = useAgentConnection();
  const towns = useTownsSync();
  const [setupComplete, setSetupComplete] = useState(false);
  const [setupStep, setSetupStep] = useState("Connecting...");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!wallet || isAgentConnected || setupComplete || isConnecting || !towns) return;

    const runSetup = async () => {
      setIsConnecting(true);
      try {
        const account = wallet.getAccount();
        if (!account) {
          setIsConnecting(false);
          return;
        }

        // ✅ STEP 1: Try saved context (instant reconnect)
        const savedContext = getSignerContext(account.address);
        
        if (savedContext) {
          setSetupStep("Restoring saved session...");
          console.log('⚡ Fast reconnect: Using saved SignerContext');
          
          try {
            const restoredAgent = await connectTowns(savedContext, {
              townsConfig: TOWNS_CONFIG,
            });
            
            towns.setSyncAgent(restoredAgent);
            
            console.log('✅ Reconnected instantly (~500ms-1s)');
            setSetupComplete(true);
            setIsConnecting(false);
            return;
            
          } catch (error: any) {
            console.warn('⚠️ Saved context invalid:', error.message);
            clearSignerContext();
          }
        }

        // ✅ STEP 2: Fresh signature
        setSetupStep("Please sign the message...");
        console.log('🔐 Requesting wallet signature...');

        const signer = await createTownsSigner(account, client, activeChain);

        if (signerRef) {
          signerRef.current = signer;
          console.log('💾 Signer cached for reuse');
        }

        const newAgent = await signAndConnect(signer, {
          townsConfig: TOWNS_CONFIG,
        });

        towns.setSyncAgent(newAgent);

        // ✅ STEP 3: Save context for next time
        try {
          const context = (newAgent as any).config?.context;
          
          if (context && context.rootKey && context.delegateKey) {
            saveSignerContext(context, account.address);
            console.log('✅ Context saved - next login will be instant!');
          } else {
            console.warn('⚠️ Could not extract context - next visit will need signature');
          }
        } catch (error) {
          console.warn('⚠️ Failed to save context:', error);
        }

        console.log('✅ Connected successfully');
        setSetupComplete(true);

      } catch (error: any) {
        console.error('❌ Setup failed:', error);
        setSetupStep("Setup failed - please refresh");
        
        if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
          window.KEY_SHARER_ERROR = error.message;
          window.KEY_SHARER_CONNECTED = false;
        }
        
        alert(`Setup failed: ${error.message}`);
      } finally {
        setIsConnecting(false);
      }
    };

    runSetup();
  }, [wallet, isAgentConnected, setupComplete, isConnecting, towns, signerRef]);

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
            📝 Check your wallet for the signature request
          </p>
        )}
        {setupStep.includes("saved session") && (
          <p className="font-georgia-pro text-xs text-gray-400 mt-2">
            ⚡ Reconnecting instantly - no signature needed!
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

  const syncAgent = useSyncAgent();

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

  useEffect(() => {
    if (space) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 Space Sync Status:');
      console.log('   Initialized:', space.initialized);
      console.log('   Channel IDs:', space.channelIds);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  }, [space]);

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
          console.log(`⏳ Retrying in ${delay/1000}s...`);
          setLoadingStep(`Network busy, retrying in ${delay/1000}s...`);
          await new Promise(r => setTimeout(r, delay));
        }

        setJoinAttempt(attempt + 1);
        console.log(`🚀 Join attempt ${attempt + 1}/${maxRetries}...`);
        setLoadingStep(`Joining space (attempt ${attempt + 1}/${maxRetries})...`);

        await joinSpace(spaceId, signer, { skipMintMembership });

        console.log('✅ Joined successfully!');
        return;

      } catch (error: any) {
        if (error.message?.includes('already a member') || 
            error.message?.includes('Already joined')) {
          console.log('✅ Already a member');
          return;
        }

        const isTransient =
          error.message?.includes('CANNOT_CONNECT') ||
          error.message?.includes('429') ||
          error.message?.includes('Bandwidth limit') ||
          error.message?.includes('Too Many Requests') ||
          error.message?.includes('failed_precondition') ||
          error.message?.includes('deadline_exceeded');

        if (isTransient && attempt < maxRetries - 1) {
          console.log(`⚠️ Transient error, will retry...`);
          continue;
        }

        console.error('❌ Join failed:', error);
        throw error;
      }
    }

    throw new Error('Failed to join after all retries');
  };

  useEffect(() => {
    if (!isAgentConnected || !syncAgent) {
      if (!isAgentConnected) {
        console.log('⏳ Waiting for agent connection...');
      } else if (!syncAgent) {
        console.log('⏳ Agent connected, waiting for sync agent...');
      }
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
      console.log('⚠️ No cached signer, creating new one...');
      signer = await createTownsSigner(account, client, activeChain);
      if (signerRef) {
        signerRef.current = signer;
      }
    } else {
      console.log('✅ Reusing cached signer');
    }

    setLoadingStep('Checking membership...');

    // ✅ Try to join without minting first to check if already a member
    let needsToMint = true;
    try {
      console.log('🔍 Checking if already a member (trying join without mint)...');
      await joinSpace(SAVED_SPACE_ID, signer, { skipMintMembership: true });
      
      console.log('✅ Already a member - joined without minting!');
      needsToMint = false;
      setHasJoined(true);
      
    } catch (error: any) {
      const errorMsg = error.message?.toLowerCase() || '';
      
      // Check if it's specifically a "not a member" error
      if (errorMsg.includes('not a member') || 
          errorMsg.includes('not entitled') ||
          errorMsg.includes('no membership') ||
          errorMsg.includes('must be a member')) {
        
        console.log('📝 Not a member yet - will mint membership NFT');
        needsToMint = true;
        
      } else if (errorMsg.includes('already a member') || 
                 errorMsg.includes('already joined')) {
        
        console.log('✅ Already a member (from error message)');
        needsToMint = false;
        setHasJoined(true);
        
      } else {
        // Unknown error - try with minting as fallback
        console.warn('⚠️ Unknown error during membership check:', error.message);
        console.log('   Will attempt to mint as fallback');
        needsToMint = true;
      }
    }

    // ✅ If they need membership NFT, mint it with retry logic
    if (needsToMint) {
      setLoadingStep('Minting membership NFT...');
      console.log('💳 Minting Space membership NFT...');
      
      await joinWithRetry(SAVED_SPACE_ID, signer, 3, false);
      
      console.log('✅ Minted and joined successfully!');
      setHasJoined(true);
    }

    setLoadingStep('Space joined successfully!');

    if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
      window.KEY_SHARER_SPACE_JOINED = true;
    }

  } catch (error: any) {
    console.error('❌ Join failed after all retries:', error);

    let errorMessage = 'Failed to join chat. ';
    if (error.message?.includes('429') || error.message?.includes('Bandwidth limit')) {
      errorMessage += 'Network is busy, please wait a moment and try again.';
    } else if (error.message?.includes('CANNOT_CONNECT')) {
      errorMessage += 'Cannot connect to network, please check your internet.';
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
  }, [isAgentConnected, syncAgent, wallet, hasJoined, isJoining, joinSpace, signerRef]);

  useEffect(() => {
    if (hasJoined && space?.initialized) {
      console.log('✅ Space fully initialized with channels:', space.channelIds);
    }
  }, [hasJoined, space?.initialized, space?.channelIds]);

  if (!isAgentConnected || !syncAgent) {
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
              Retry {joinAttempt}/3 - Network is busy, please wait...
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
          <p className="font-georgia-pro text-red-500">❌ Space not found</p>
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
            Syncing with stream nodes...
          </p>
          <p className="font-georgia-pro text-xs text-gray-400 mt-2">
            This should take 5-10 seconds
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
          <p className="font-georgia-pro text-red-500">❌ No channels found</p>
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
              🤖 Bot Mode: Connecting wallet programmatically...
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
