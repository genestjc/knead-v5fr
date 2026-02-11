'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo } from 'react';
import { useAgentConnection, useJoinSpace, useSpace } from '@towns-protocol/react-sdk';
import { useActiveWallet } from 'thirdweb/react';
import { client, activeChain, townsChainRpc } from '@/thirdweb-client';
import { townsEnv } from '@towns-protocol/sdk';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { getEthersV5Signer } from '@/lib/ethers-signer-adapter';
import type { ChatUser } from '@/types/chat';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { saveTownsAuth, getSavedTownsAuth, clearTownsAuth } from '@/lib/towns/auth-persistence';

const SAVED_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
const SAVED_CHANNEL_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID;

const JOIN_VERSION = 'v2';

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
  const wallet = useActiveWallet();
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
          
          const signer = await getEthersV5Signer(botAccount, activeChain, client);
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

    const activeWallet = wallet || botAccount;

    console.log('🤖 Bot Status:', {
      hasWallet: !!activeWallet,
      walletAddress: activeWallet?.getAccount?.()?.address,
      agentConnected: isAgentConnected,
    });

    if (activeWallet && isAgentConnected) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ BOT SUCCESSFULLY CONNECTED');
      console.log(`   Wallet: ${activeWallet.getAccount?.()?.address}`);
      console.log(`   Time: ${new Date().toISOString()}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      window.KEY_SHARER_CONNECTED = true;
      window.KEY_SHARER_ATTEMPTED = true;
      delete window.KEY_SHARER_ERROR;
    } else {
      window.KEY_SHARER_ATTEMPTED = true;
      window.KEY_SHARER_CONNECTED = false;
    }
  }, [wallet, botAccount, isAgentConnected]);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETUP FLOW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SetupFlow() {
    const wallet = useActiveWallet();
    const { connect, connectUsingBearerToken, isAgentConnected, isAgentConnecting } = useAgentConnection();
    const [setupComplete, setSetupComplete] = useState(false);
    const [setupStep, setSetupStep] = useState("Connecting...");

    useEffect(() => {
        if (!wallet || isAgentConnected || setupComplete) return;

        const runSetup = async () => {
            try {
                const userAddress = wallet.getAccount()?.address;
                if (!userAddress) return;

                // ✅ TRY BEARER TOKEN FIRST
                const savedToken = getSavedTownsAuth();
                
                if (savedToken) {
                    setSetupStep("Reconnecting with saved session...");
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
                        return;
                        
                    } catch (tokenError: any) {
                        console.warn('⚠️ Saved token failed, will request new signature:', tokenError.message);
                        clearTownsAuth();
                    }
                }

                // ✅ SIGNATURE-BASED AUTH
                setSetupStep("Please sign the message in your wallet...");
                const signer = await getEthersV5Signer(wallet, activeChain, client);
                
                console.log('🔐 Requesting signature for Towns authentication...');
                const agent = await connect(signer, { 
                    townsConfig: TOWNS_CONFIG,
                    onTokenExpired: () => {
                        console.log('⚠️ Token expired');
                        clearTownsAuth();
                    }
                });
                
                console.log('✅ Towns agent connected');
                
                // ✅ SAVE BEARER TOKEN
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
                
                console.log('⛽ Gas sponsorship enabled via EIP-7702');
                setSetupComplete(true);

            } catch (error: any) {
                console.error('❌ Setup failed:', error);
                setSetupStep("Setup failed - please refresh");
                
                if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
                    window.KEY_SHARER_ERROR = error.message;
                    window.KEY_SHARER_CONNECTED = false;
                }
                
                alert(`Setup failed: ${error.message}`);
            }
        };

        runSetup();
    }, [wallet, isAgentConnected, setupComplete, connect, connectUsingBearerToken]);

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
                {isAgentConnecting && (
                    <p className="font-georgia-pro text-xs text-gray-400 mt-2">
                        🔗 Connecting to Towns network...
                    </p>
                )}
            </div>
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOWNS CHAT - ✅ FIXED: Wait for isAgentConnected before joining
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TownsChat() {
    const [spaceId] = useState<string | null>(SAVED_SPACE_ID || null);
    const [hasJoined, setHasJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);

    const wallet = useActiveWallet();
    const { isAgentConnected } = useAgentConnection(); // ✅ ADD THIS
    const { joinSpace } = useJoinSpace();
    const { data: space, isLoading: isSpaceLoading } = useSpace(spaceId || '');

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

    // ✅ Log space status (React will re-run when space updates)
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

    // ✅ Join space ONCE (ONLY when agent is connected)
    useEffect(() => {
        // ✅ CRITICAL: Don't join until agent is connected!
        if (!isAgentConnected) {
            console.log('⏳ Waiting for agent connection before joining space...');
            return;
        }

        if (hasJoined || isJoining || !wallet || !SAVED_SPACE_ID) return;

        const joinSpaceNow = async () => {
            setIsJoining(true);
            
            try {
                const userAddress = wallet.getAccount()?.address;
                if (!userAddress) {
                    setIsJoining(false);
                    return;
                }

                const hasJoinedBefore = localStorage.getItem(`joined_${JOIN_VERSION}_${SAVED_SPACE_ID}_${userAddress}`);
                
                if (hasJoinedBefore) {
                    console.log('✅ User already joined before');
                    setHasJoined(true);
                    setIsJoining(false);
                    return;
                }

                console.log('🚀 Joining space with skipMintMembership: true');
                const signer = await getEthersV5Signer(wallet, activeChain, client);
                
                await joinSpace(SAVED_SPACE_ID, signer, { 
                    skipMintMembership: true
                });
                
                console.log('✅ Join space successful!');
                localStorage.setItem(`joined_${JOIN_VERSION}_${SAVED_SPACE_ID}_${userAddress}`, 'true');
                setHasJoined(true);

            } catch (error: any) {
                const userAddress = wallet.getAccount()?.address;
                
                if (error.message?.includes('already a member')) {
                    console.log('✅ Already a member - treating as success');
                    if (userAddress) {
                        localStorage.setItem(`joined_${JOIN_VERSION}_${SAVED_SPACE_ID}_${userAddress}`, 'true');
                    }
                    setHasJoined(true);
                } else {
                    console.error('❌ Join failed:', error);
                    
                    if (typeof window !== 'undefined' && window.KEY_SHARER_AUTO_MODE) {
                        window.KEY_SHARER_ERROR = error.message;
                        window.KEY_SHARER_CONNECTED = false;
                    }
                    
                    alert(`Failed to join space: ${error.message}`);
                }
            } finally {
                setIsJoining(false);
            }
        };

        joinSpaceNow();
    }, [isAgentConnected, wallet, hasJoined, isJoining, joinSpace]); // ✅ ADD isAgentConnected to deps

    // ✅ Handle initialization (React will re-run when space.initialized changes)
    useEffect(() => {
        if (hasJoined && space?.initialized) {
            console.log('✅ Space fully initialized with channels:', space.channelIds);
        }
    }, [hasJoined, space?.initialized, space?.channelIds]);

    // ✅ Show loading if agent not connected yet
    if (!isAgentConnected) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <LoadingSpinner />
                    <p className="font-georgia-pro text-sm text-gray-500 mt-4">
                        Connecting to Towns network...
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
                    <p className="font-georgia-pro text-sm text-gray-500 mt-2">
                        Space ID: {spaceId?.substring(0, 16)}...
                    </p>
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
    
    useBotAutoConnect();

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
      if (!wallet) {
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

    return <TownsChat />;
}
