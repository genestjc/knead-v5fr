'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAgentConnection, useJoinSpace, useSpace, useSyncAgent } from '@towns-protocol/react-sdk';
import { useActiveWallet } from 'thirdweb/react';
import { createTownsSigner } from '@/lib/towns-signer-adapter';
import { client, activeChain } from '@/thirdweb-client';
import { TOWNS_RPC_CONFIG } from '@/thirdweb-client';
import { townsEnv } from '@towns-protocol/sdk';
import { privateKeyToAccount } from 'thirdweb/wallets';
import type { ChatUser } from '@/types/chat';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';

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

// ✅ Configure RPC URL for Towns SDK (client-side)
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL 
  || process.env.NEXT_PUBLIC_BASE_RPC_URL 
  || TOWNS_RPC_CONFIG.rpc;

console.log('🔧 Configuring Towns SDK with RPC:', BASE_RPC?.substring(0, 50) + '...');

// ✅ Pass RPC URL to Towns SDK via environment override
const townsEnvWithRpc = townsEnv({
  env: {
    BASE_MAINNET_RPC_URL: BASE_RPC,
  }
});

const TOWNS_CONFIG = townsEnvWithRpc.makeTownsConfig('omega');

console.log('✅ Towns Config created');
console.log('   Environment:', TOWNS_CONFIG.environmentId);
console.log('   Base RPC:', TOWNS_CONFIG.base?.rpcUrl?.substring(0, 50) + '...');
console.log('   River RPC:', TOWNS_CONFIG.river?.rpcUrl?.substring(0, 50) + '...');

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ BOT AUTO-CONNECT HOOK (for headless Render bot only)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
          console.log('   Signer created:', !!signer);
          
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━���━━━━━━━━━━━━━━━━
// SETUP FLOW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SetupFlow({ signerRef }: { signerRef?: { current: any } }) {
    const wallet = useActiveWallet();
    const { connect, isAgentConnected } = useAgentConnection();
    const [setupComplete, setSetupComplete] = useState(false);
    const [setupStep, setSetupStep] = useState("Connecting...");
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
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
                
                console.log('🔐 Creating ethers v5 signer from ThirdWeb wallet...');
                console.log('🌐 Using omega (mainnet) environment');
                
                const signer = await createTownsSigner(account, client, activeChain);
                
                // ✅ Cache signer for reuse in joinSpaceNow()
                if (signerRef) {
                    signerRef.current = signer;
                    console.log('💾 Signer cached for reuse');
                }
                
                console.log('✅ Signer created, requesting Towns authentication signature...');
                
                await connect(signer, { 
                    townsConfig: TOWNS_CONFIG,
                    onTokenExpired: () => {
                        console.log('⚠️ Token expired');
                    }
                });
                
                console.log('✅ Towns agent connected');
                
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
    }, [wallet, isAgentConnected, setupComplete, isConnecting, connect, signerRef]);

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
            </div>
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOWNS CHAT - ✅ SIMPLE HUMAN-CENTERED LOGIC (bot auto-joins via same flow)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TownsChat({ signerRef }: { signerRef?: { current: any } }) {
    const [spaceId] = useState<string | null>(SAVED_SPACE_ID || null);
    const [hasJoined, setHasJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [joinAttempt, setJoinAttempt] = useState(0); // ✅ Track retry attempts
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

    useEffect(() => {
        if (space) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📊 Space Sync Status:');
            console.log('   Initialized:', space.initialized);
            console.log('   Channel IDs:', space.channelIds);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
    }, [space]);

    // ✅ RETRY LOGIC: Wrap joinSpace with exponential backoff
    const joinWithRetry = async (spaceId: string, signer: any, maxRetries = 3, skipMintMembership = true) => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                setJoinAttempt(attempt + 1);
                console.log(`🚀 Join attempt ${attempt + 1}/${maxRetries}...`);
                
                await joinSpace(spaceId, signer, { skipMintMembership });
                
                console.log('✅ Joined successfully!');
                return; // Success!
                
            } catch (error: any) {
                // ✅ Handle "already a member" as success
                if (error.message?.includes('already a member') || error.message?.includes('Already joined')) {
                    console.log('✅ Already a member');
                    return;
                }
                
                // ✅ Check if error is transient (RPC/network issue)
                const isTransient = error.message?.includes('CANNOT_CONNECT') 
                    || error.message?.includes('429')
                    || error.message?.includes('Bandwidth limit')
                    || error.message?.includes('Too Many Requests')
                    || error.message?.includes('failed_precondition');
                
                if (isTransient && attempt < maxRetries - 1) {
                    const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                    console.log(`⏳ Stream node busy (429 rate limit), retrying in ${delay/1000}s...`);
                    await new Promise(r => setTimeout(r, delay));
                    continue; // Retry
                }
                
                // ✅ Non-transient error or max retries reached
                console.error('❌ Join failed after retries:', error);
                throw error;
            }
        }
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
                
                // ✅ ONLY for bot: wait for river sync (reduced from 15s to 3s)
                if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
                    setLoadingStep('Bot Mode: Waiting for river connection...');
                    console.log('🤖 Bot Mode: Waiting 3s for river connection...');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    window.KEY_SHARER_SPACE_JOINED = true;
                }
                
                setLoadingStep('Preparing to join space...');
                
                // ✅ Reuse signer from agent connection if available
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
                
                setLoadingStep('Joining space...');
                
                // ✅ Determine if user is freemium for skipMintMembership optimization
                // TODO: In production, call getUserRole(account.address) to determine actual role
                // and set skipMint = (userRole === 'freemium') for role-based optimization
                const skipMint = true; // Default to true for faster joins
                
                // ✅ Join with retry logic
                await joinWithRetry(SAVED_SPACE_ID, signer, 3, skipMint);
                
                setLoadingStep('Space joined successfully!');
                setHasJoined(true);

            } catch (error: any) {
                console.error('❌ Join failed after all retries:', error);
                
                // ✅ User-friendly error messages
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
                setLoadingStep('Initializing...'); // Reset for next attempt
            }
        };

        joinSpaceNow();
    }, [isAgentConnected, syncAgent, wallet, hasJoined, isJoining, joinSpace]);

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function ChatTestClient() {
    const [isMounted, setIsMounted] = useState(false);
    const wallet = useActiveWallet();
    const { isAgentConnected } = useAgentConnection();
    
    const { botWallet } = useBotAutoConnect();
    
    // ✅ Use useRef for signer caching (proper React pattern)
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

    // ✅ Bot mode: use bot wallet, otherwise wait for human wallet
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
