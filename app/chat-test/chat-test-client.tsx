'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount, useActiveWalletConnectionStatus } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { useAgentConnection } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import type { ChatUser } from '@/types/chat';
import nextDynamic from 'next/dynamic';
import { ethers } from 'ethers-v5';
import { createClient } from '@supabase/supabase-js';

// Dynamically import the connected chat component
const ConnectedChat = nextDynamic(() => import('./connected-chat'), {
  ssr: false,
});

// Component that handles space creation - only renders when connected
const SpaceCreator = nextDynamic(() => import('./space-creator'), {
  ssr: false,
});

// Towns Protocol environment config
const townsConfig = townsEnv().makeTownsConfig('omega');

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Hardcoded space IDs (fill these in after creating the space)
const HARDCODED_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_SPACE_ID || null;
const HARDCODED_CHANNEL_ID = process.env.NEXT_PUBLIC_KNEAD_DEFAULT_CHANNEL_ID || null;

export default function ChatTestClient() {
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [defaultChannelId, setDefaultChannelId] = useState<string | null>(null);
  const [loadingSpace, setLoadingSpace] = useState(true);
  const account = useActiveAccount();
  const connectionStatus = useActiveWalletConnectionStatus();

  const { connect, disconnect, isAgentConnecting, isAgentConnected } = useAgentConnection();

  // Fetch existing space from Supabase
  useEffect(() => {
    async function fetchSpace() {
      setLoadingSpace(true);
      
      // First, check hardcoded env vars
      if (HARDCODED_SPACE_ID && HARDCODED_CHANNEL_ID) {
        console.log('✅ Using hardcoded Knead space IDs');
        setSpaceId(HARDCODED_SPACE_ID);
        setDefaultChannelId(HARDCODED_CHANNEL_ID);
        setLoadingSpace(false);
        return;
      }

      // Otherwise, fetch from Supabase
      try {
        const { data, error } = await supabase
          .from('towns_spaces')
          .select('space_id, default_channel_id')
          .eq('is_active', true)
          .eq('space_name', 'Knead')
          .maybeSingle();

        if (data && !error) {
          console.log('✅ Found existing Knead space in Supabase:', data);
          setSpaceId(data.space_id);
          setDefaultChannelId(data.default_channel_id);
        } else {
          console.log('No existing Knead space found');
        }
      } catch (error) {
        console.error('Error fetching space from Supabase:', error);
      } finally {
        setLoadingSpace(false);
      }
    }

    fetchSpace();
  }, []);

  // Fetch or create Knead user profile
  useEffect(() => {
    async function fetchUser() {
      if (!account?.address) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/chat/get-or-create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: account.address,
          }),
        });

        const data = await response.json();
        
        if (data.success && data.user) {
          setCurrentUser(data.user);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [account?.address]);

  // Connect to Towns when wallet is connected
  useEffect(() => {
    if (!account?.address || isAgentConnected || isAgentConnecting || connectionStatus !== 'connected') {
      return;
    }

    const connectToTowns = async () => {
      try {
        if (typeof window === 'undefined' || !window.ethereum) {
          console.error('No ethereum provider found');
          return;
        }

        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        const signer = provider.getSigner();

        await connect(signer, { townsConfig });
        console.log('✅ Connected to Towns Protocol');
      } catch (err) {
        console.error('Failed to connect to Towns:', err);
      }
    };

    connectToTowns();
  }, [account?.address, isAgentConnected, isAgentConnecting, connectionStatus, connect]);

  const handleManualConnect = async () => {
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        alert('No Web3 wallet detected. Please install MetaMask or another Web3 wallet.');
        return;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();
      await connect(signer, { townsConfig });
    } catch (err) {
      console.error('Connection failed:', err);
      alert('Failed to connect to Towns Protocol. Check console for details.');
    }
  };

  // Callback when space is created
  const handleSpaceCreated = (newSpaceId: string, newChannelId: string) => {
    setSpaceId(newSpaceId);
    setDefaultChannelId(newChannelId);
  };

  // Loading state
  if (loading || loadingSpace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not connected
  if (!account?.address) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-5xl mb-6">Knead Chat</h1>
          <p className="font-georgia-pro text-lg mb-8 text-gray-600">
            Connect your wallet to join the conversation
          </p>
          <ThirdWebConnectButton />
        </div>
      </div>
    );
  }

  // Wallet connected but Towns not authenticated
  if (!isAgentConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-4xl mb-4">Connecting to Towns...</h1>
          {isAgentConnecting ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
              <p className="font-georgia-pro text-gray-600">
                Please sign the message in your wallet to authenticate
              </p>
            </>
          ) : (
            <>
              <p className="font-georgia-pro text-gray-600 mb-6">
                Towns Protocol requires wallet signature for authentication
              </p>
              <button
                onClick={handleManualConnect}
                className="px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
              >
                Connect to Towns
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Connected but no space - need to create one (use separate component)
  if (!spaceId || !defaultChannelId) {
    return (
      <SpaceCreator 
        walletAddress={account?.address || ''} 
        onSpaceCreated={handleSpaceCreated}
      />
    );
  }

  // Connected AND have space! Now render the chat component
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-600">Loading user profile...</p>
        </div>
      </div>
    );
  }

  return <ConnectedChat currentUser={currentUser} spaceId={spaceId} defaultChannelId={defaultChannelId} />;
}
