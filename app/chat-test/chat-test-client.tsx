'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo } from 'react';
import { useAgentConnection, useJoinSpace, useSpace, useSyncAgent } from '@towns-protocol/react-sdk';
import { useActiveAccount } from 'thirdweb/react';
import { client, activeChain, townsChainRpc } from '@/thirdweb-client';
import { townsEnv } from '@towns-protocol/sdk';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { ethers5Adapter } from "thirdweb/adapters/ethers5";
import type { ChatUser } from '@/types/chat';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { saveTownsAuth, getSavedTownsAuth, clearTownsAuth } from '@/lib/towns/auth-persistence';

const SAVED_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
const SAVED_CHANNEL_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID;

const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega', {
  rpcUrl: townsChainRpc,
});

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
// ✅ BOT AUTO-CONNECT HOOK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function useBotAutoConnect() {
  const { connect: connectAgent, isAgentConnected } = useAgentConnection();
  const account = useActiveAccount();
  const [botAccount, setBotAccount] = useState<any>(null);
  const [botInitialized, setBotInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.KEY_SHARER_AUTO_MODE || !window.KEY_SHARER_PRIVATE_KEY) {
      return;
    }

    if (botInitialized) {
      return;
    }

    const initBotAccount = async () => {
      try {
        console.log('🤖 Bot Mode: Creating account from private key...');
        
        const botPrivateAccount = privateKeyToAccount({
          client,
          privateKey: window.KEY_SHARER_PRIVATE_KEY!,
        });
        
        console.log('✅ Bot account created:', botPrivateAccount.address);
        
        const mockWallet = {
          getAccount: () => botPrivateAccount,
          getChain: () => activeChain,
          disconnect: async () => {},
          switchChain: async () => {},
        };
        
        console.log('✅ Bot wallet object created');
        
        setBotAccount(mockWallet);
        
        delete window.KEY_SHARER_PRIVATE_KEY;
        console.log('🧹 Private key removed from browser memory');
        
        setBotInitialized(true);
        
      } catch (error: any) {
        console.error('❌ Bot account creation failed:', error);
        console.error('   Error message:', error.message);
        window.KEY_SHARER_ERROR = `Account creation failed: ${error.message}`;
        window.KEY_SHARER_CONNECTED = false;
        setBotInitialized(true);
      }
    };

    initBotAccount();
  }, [botInitialized]);

  useEffect(() => {
    if (!botAccount || isAgentConnected) {
      return;
    }

    if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
      const initAgent = async () => {
        try {
          console.log('🤖 Bot Mode: Connecting Towns agent...');
          console.log('   Account address:', botAccount.getAccount()?.address);
          
          const signer = await ethers5Adapter.signer.toEthers({
            client,
            chain: activeChain,
            account: botAccount.getAccount(),
          });
          
          console.log('   Signer created:', !!signer);
          
          await connectAgent(signer, { 
            townsConfig: TOWNS_CONFIG,
            onTokenExpired: () => console.log('🔄 Token expired')
          });
          
          console.log('✅ Bot Towns agent connected');
          
        } catch (error: any) {
          console.error('❌ Bot agent connection failed:', error);
          console.error('   Error message:', error.message);
          console.error('   Error stack:', error.stack);
          window.KEY_SHARER_ERROR = `Agent connection failed: ${error.message}`;
          window.KEY_SHARER_CONNECTED = false;
        }
      };

      initAgent();
    }
  }, [botAccount, isAgentConnected, connectAgent]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.KEY_SHARER_AUTO_MODE) {
      return;
    }

    const activeWallet = account || botAccount;

    console.log('🤖 Bot Status:', {
      hasWallet: !!activeWallet,
      walletAddress: activeWallet?.address || botAccount?.getAccount?.()?.address,
      agentConnected: isAgentConnected,
    });

    if (activeWallet && isAgentConnected) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ BOT SUCCESSFULLY CONNECTED');
      console.log(`   Wallet: ${activeWallet.address || botAccount?.getAccount?.()?.address}`);
      console.log(`   Time: ${new Date().toISOString()}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      window.KEY_SHARER_CONNECTED = true;
      window.KEY_SHARER_ATTEMPTED = true;
      delete window.KEY_SHARER_ERROR;
    } else {
      window.KEY_SHARER_ATTEMPTED = true;
      window.KEY_SHARER_CONNECTED = false;
    }
  }, [account, botAccount, isAgentConnected]);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETUP FLOW - ✅ SIMPLIFIED WITH THIRDWEB ADAPTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SetupFlow() {
    const account = useActiveAccount();
    const { connect, connectUsingBearerToken, isAgentConnected } = useAgentConnection();
    const [setupComplete, setSetupComplete] = useState(false);
    const [setupStep, setSetupStep] = useState("Connecting...");
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        if (!account || isAgentConnected || setupComplete || isConnecting) return;

        const runSetup = async () => {
            setIsConnecting(true);
            
            try {
                const userAddress = account.address;
                if (!userAddress) {
                    setIsConnecting(false);
                    return;
                }

                // ✅ Try bearer token first (fast reconnect)
                const savedToken = getSavedTownsAuth();
                
                if (savedToken) {
                    setSetupStep("Reconnecting...");
                    console.log('🔄 Attempting to reconnect with bearer token...');
                    
                    try {
                        await connectUsingBearerToken(savedToken, { 
                            townsConfig: TOWNS_CONFIG,
                            onTokenExpired: () => {
                                console.log('⚠️ Token expired');
                                clearTownsAuth();
                            }
                        });
                        
                        console.log('✅ Reconnected with saved session - no signature needed!');
                        setSetupComplete(true);
                        setIsConnecting(false);
                        return;
                        
                    } catch (tokenError: any) {
                        console.warn('⚠️ Saved token failed, will request new signature:', tokenError.message);
                        clearTownsAuth();
                    }
                }

                // ✅ Signature-based auth with ThirdWeb's built-in adapter
                setSetupStep("Please sign the message...");
                
                console.log('🔐 Creating ethers v5 signer from ThirdWeb account...');
                
                // ✅ ONE LINE - works for ALL wallet types (in-app, MetaMask, Coinbase, etc.)
                const signer = await ethers5Adapter.signer.toEthers({
                    client,
                    chain: activeChain,
                    account,
                });
                
                console.log('✅ Signer created, requesting Towns authentication signature...');
                
                const agent = await connect(signer, { 
                    townsConfig: TOWNS_CONFIG,
                    onTokenExpired: () => {
                        console.log('⚠️ Token expired');
                        clearTownsAuth();
                    }
                });
                
                console.log('✅ Towns agent connected');
                
                // ✅ Save bearer token for next time
                try {
                    const syncAgent = agent as any;
                    if (syncAgent?.auth?.token || syncAgent?.authToken || syncAgent?.token) {
                        const token = syncAgent.auth?.token || syncAgent.authToken || syncAgent.token;
                        saveTownsAuth(token);
                        console.log('💾 Saved bearer token for future sessions');
                    }
                } catch (saveError) {
                    console.warn('⚠️ Could not save bearer token:', saveError);
                }
                
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
    }, [account, isAgentConnected, setupComplete, isConnecting, connect, connectUsingBearerToken]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center max-w-md px-4">
                <h2 className="font-adonis text-3xl mb-4">
                    {setupStep.includes("Reconnecting") ? "Welcome Back" : "Connecting to Chat"}
                </h2>
                <LoadingSpinner />
                <p className="font-georgia-pro text-sm text-gray-600 mt-4">
                    {setupStep}
                </p>
                {setupStep.includes("sign the message") && (
                    <p className="font-georgia-pro text-xs text-gray-400 mt-2">
                        📝 Check your wallet for the signature request
                    </p>
                )}
                {setupStep.includes("Reconnecting") && (
                    <p className="font-georgia-pro text-xs text-gray-400 mt-2">
                        ⚡ No signature needed - using saved session
                    </p>
                )}
            </div>
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOWNS CHAT - ✅ SIMPLIFIED WITH THIRDWEB ADAPTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TownsChat() {
    const [spaceId] = useState<string | null>(SAVED_SPACE_ID || null);
    const [hasJoined, setHasJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);

    const account = useActiveAccount();
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
        if (!account?.address) return null;
        
        return {
            id: account.address,
            address: account.address,
            displayName: `${account.address.slice(0, 6)}...${account.address.slice(-4)}`,
            role: 'viewer',
            membershipTier: 'freemium',
            isBanned: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }, [account]);

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

        if (hasJoined || isJoining || !account || !SAVED_SPACE_ID) return;

        const joinSpaceNow = async () => {
            setIsJoining(true);
            
            try {
                const userAddress = account.address;
                if (!userAddress) {
                    setIsJoining(false);
                    return;
                }
                
                console.log('🔍 Checking membership status...');
                const checkRes = await fetch('/api/towns/check-membership', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userAddress }),
                });
                
                const membershipData = await checkRes.json();
                
                if (membershipData.success) {
                    const { hasMembership, totalMembers, isUnder100 } = membershipData;
                    
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('📊 Membership Status:');
                    console.log('   Has membership:', hasMembership);
                    console.log('   Total members:', totalMembers);
                    console.log('   Free tier active:', isUnder100);
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    
                    if (!hasMembership && !isUnder100) {
                        console.warn('⚠️ Over 100 members - new mints may cost gas');
                    }
                }
                
                console.log('⏳ Stabilizing...');
                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('🚀 Joining space...');
                
                const signer = await ethers5Adapter.signer.toEthers({
                    client,
                    chain: activeChain,
                    account,
                });
                
                const hasMembership = membershipData?.hasMembership || false;
                
                await joinSpace(SAVED_SPACE_ID, signer, {
                    skipMintMembership: hasMembership
                });
                
                console.log('✅ Joined successfully!');
                setHasJoined(true);

            } catch (error: any) {
                if (error.message?.includes('already a member')) {
                    console.log('✅ Already a member');
                    setHasJoined(true);
                } else {
                    console.error('❌ Join failed:', error);
                    alert(`Failed to join: ${error.message}`);
                }
            } finally {
                setIsJoining(false);
            }
        };

        joinSpaceNow();
    }, [isAgentConnected, syncAgent, account, hasJoined, isJoining, joinSpace]);

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
    const account = useActiveAccount();
    const { isAgentConnected } = useAgentConnection();
    
    useBotAutoConnect();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
      const hasExportIntent = localStorage.getItem("exportKeyIntent") === "1";
      
      if (hasExportIntent && account && isAgentConnected) {
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
    }, [account, isAgentConnected]);

    if (!isMounted) return <LoadingSpinner />;

    if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
      if (!account) {
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

      return <TownsChat />;
    }

    if (!account) {
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

    return <TownsChat />;
}
