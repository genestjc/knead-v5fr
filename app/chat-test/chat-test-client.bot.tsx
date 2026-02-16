'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo } from 'react';
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
// ✅ LIGHTWEIGHT RETRY HELPER (for RPC calls only)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  initialDelay: number = 1000,
  context: string = 'operation'
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      const isRateLimitError = 
        error.message?.includes('429') ||
        error.message?.includes('Too Many Requests') ||
        error.message?.includes('Bandwidth limit exceeded') ||
        error.message?.includes('-31002');
      
      const isLastAttempt = attempt === maxRetries - 1;
      
      if (isRateLimitError && !isLastAttempt) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`⚠️ Rate limit hit on ${context}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ BOT AUTO-CONNECT HOOK (for automated message client/node)
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETUP FLOW - ✅ CLEAN (NO BEARER TOKEN CACHING)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SetupFlow() {
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
    }, [wallet, isAgentConnected, setupComplete, isConnecting, connect]);

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
// TOWNS CHAT - ✅ HYBRID: SEPARATED BOT/HUMAN + MINIMAL RETRY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TownsChat({ botWallet }: { botWallet: any }) {
    const [spaceId] = useState<string | null>(SAVED_SPACE_ID || null);
    const [hasJoined, setHasJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);

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

    // ✅ For humans: use wallet directly. For bots: use botWallet
    const effectiveWallet = wallet || botWallet;

    const currentUser: ChatUser | null = useMemo(() => {
        const address = effectiveWallet?.getAccount?.()?.address;
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
    }, [effectiveWallet]);

    useEffect(() => {
        if (space) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📊 Space Sync Status:');
            console.log('   Initialized:', space.initialized);
            console.log('   Channel IDs:', space.channelIds);
            console.log('   Metadata:', space.metadata);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
    }, [space]);

    useEffect(() => {
        if (!isAgentConnected || !syncAgent) {
            if (!isAgentConnected) {
                console.log('⏳ Waiting for agent connection...');
            } else if (!syncAgent) {
                console.log('⏳ Agent connected, waiting for sync agent...');
            }
            return;
        }
    }, [isAgentConnected, syncAgent]);

    // ━━━ BOT JOIN (only runs in KEY_SHARER_AUTO_MODE) ━━━
    useEffect(() => {
        if (typeof window === 'undefined' || !window.KEY_SHARER_AUTO_MODE) return;
        if (!isAgentConnected || !syncAgent || !botWallet || !SAVED_SPACE_ID) return;
        if (hasJoined || isJoining) return;

        const joinAsBot = async () => {
            setIsJoining(true);
            
            try {
                const account = botWallet.getAccount?.();
                if (!account) { 
                    setIsJoining(false); 
                    return; 
                }

                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('🤖 Bot Mode: Waiting for river connection...');
                console.log('   (15 second delay for SDK initialization)');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

                await new Promise(resolve => setTimeout(resolve, 15000));

                console.log('🤖 Bot: Calling joinSpace with skipMintMembership...');
                console.log('   Account:', account.address);

                const signer = await createTownsSigner(account, client, activeChain);
                
                try {
                    await joinSpace(SAVED_SPACE_ID, signer, { 
                        skipMintMembership: true
                    });
                    console.log('✅ Bot: joinSpace succeeded');
                    setHasJoined(true);
                    window.KEY_SHARER_SPACE_JOINED = true;
                } catch (joinError: any) {
                    // One retry for rate limits
                    if (joinError.message?.includes('429') || joinError.message?.includes('Too Many')) {
                        console.warn('⚠️ Bot rate limited, retrying once after 3s...');
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        await joinSpace(SAVED_SPACE_ID, signer, { skipMintMembership: true });
                        console.log('✅ Bot: joinSpace succeeded on retry');
                        setHasJoined(true);
                        window.KEY_SHARER_SPACE_JOINED = true;
                    } else if (joinError.message?.includes('already a member')) {
                        console.log('✅ Bot: Already a member — treating as joined');
                        setHasJoined(true);
                        window.KEY_SHARER_SPACE_JOINED = true;
                    } else {
                        throw joinError;
                    }
                }
            } catch (error: any) {
                console.error('❌ Bot joinSpace error:', error.message);
                window.KEY_SHARER_ERROR = error.message;
            } finally {
                setIsJoining(false);
            }
        };

        joinAsBot();
    }, [isAgentConnected, syncAgent, botWallet, hasJoined, isJoining, joinSpace]);

    // ━━━ HUMAN JOIN (never runs in bot mode) ━━━
    useEffect(() => {
        if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) return;
        if (!isAgentConnected || !syncAgent || !wallet || !SAVED_SPACE_ID) return;
        if (hasJoined || isJoining) return;

        const joinAsHuman = async () => {
            setIsJoining(true);
            
            try {
                const account = wallet.getAccount();
                if (!account) { 
                    setIsJoining(false); 
                    return; 
                }

                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('👤 Human Mode: Joining space...');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

                console.log('🔍 Checking membership status...');
                
                // ✅ Only retry the membership API call (RPC-heavy)
                const membershipData = await retryWithBackoff(
                  async () => {
                    const checkRes = await fetch('/api/towns/check-membership', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userAddress: account.address }),
                    });
                    
                    if (!checkRes.ok) {
                      throw new Error(`HTTP ${checkRes.status}: ${checkRes.statusText}`);
                    }
                    
                    return await checkRes.json();
                  },
                  2,
                  1000,
                  'membership check'
                );
                
                if (membershipData.success) {
                    const { hasMembership, totalMembers } = membershipData;
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('📊 Membership Status:');
                    console.log('   Has membership:', hasMembership);
                    console.log('   Total members:', totalMembers);
                    console.log('   Space is FREE ✅');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                }
                
                console.log('⏳ Stabilizing...');
                await new Promise(resolve => setTimeout(resolve, 1000));  // ✅ Back to 1 second

                console.log('🚀 Joining space...');
                
                const signer = await createTownsSigner(account, client, activeChain);
                const hasMembership = membershipData?.hasMembership || false;
                
                console.log('   skipMintMembership:', hasMembership);
                
                // ✅ Direct joinSpace with one retry only for rate limits
                try {
                    await joinSpace(SAVED_SPACE_ID, signer, {
                        skipMintMembership: hasMembership
                    });
                } catch (joinError: any) {
                    if (joinError.message?.includes('429') || joinError.message?.includes('Too Many')) {
                        console.warn('⚠️ Rate limited, retrying once after 2s...');
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        await joinSpace(SAVED_SPACE_ID, signer, {
                            skipMintMembership: hasMembership
                        });
                    } else {
                        throw joinError;
                    }
                }
                
                console.log('✅ Human joined successfully!');
                setHasJoined(true);

            } catch (error: any) {
                if (error.message?.includes('already a member')) {
                    console.log('✅ Already a member');
                    setHasJoined(true);
                } else {
                    console.error('❌ Human join failed:', error);
                    
                    const isRateLimitError = 
                      error.message?.includes('429') ||
                      error.message?.includes('Too Many Requests') ||
                      error.message?.includes('Bandwidth limit exceeded');
                    
                    if (isRateLimitError) {
                      alert(`⚠️ Rate limit reached. Please:\n\n1. Wait 1-2 minutes\n2. Refresh the page\n3. Contact support if this persists`);
                    } else {
                      alert(`Failed to join: ${error.message}`);
                    }
                }
            } finally {
                setIsJoining(false);
            }
        };

        joinAsHuman();
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
                        {!isAgentConnected ? 'Connecting to Towns...' : 'Initializing...'}
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
                        {isJoining ? 'Joining space...' : 'Loading space data...'}
                    </p>
                </div>
            </div>
        );
    }

    if (!space) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <p className="font-georgia-pro text-red-500">❌ Space not found</p>
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
                        This may take 10-30 seconds
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
                    <p className="font-georgia-pro text-red-500">❌ No channels found in space</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-black text-white rounded-full"
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
        return <SetupFlow />;
      }

      return <TownsChat botWallet={botWallet} />;
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
        return <SetupFlow />;
    }

    return <TownsChat botWallet={botWallet} />;
}
