'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount, useActiveWalletConnectionStatus } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { useAgentConnection, useCreateSpace } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import type { ChatUser } from '@/types/chat';
import nextDynamic from 'next/dynamic';
import { ethers } from 'ethers-v5';
import { createClient } from '@supabase/supabase-js';

// Dynamically import the connected chat component
const ConnectedChat = nextDynamic(() => import('./connected-chat'), {
  ssr: false,
});

// Towns Protocol environment config
const townsConfig = townsEnv().makeTownsConfig('gamma');

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ChatTestClient() {
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [defaultChannelId, setDefaultChannelId] = useState<string | null>(null);
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [loadingSpace, setLoadingSpace] = useState(true);
  const account = useActiveAccount();
  const connectionStatus = useActiveWalletConnectionStatus();

  const { connect, disconnect, isAgentConnecting, isAgentConnected } = useAgentConnection();
  const { createSpace, isPending: isCreatingSpace } = useCreateSpace();

  // Fetch existing space from Supabase
  useEffect(() => {
    async function fetchSpace() {
      setLoadingSpace(true);
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
          console.log('No existing Knead space found in Supabase');
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

  // Create Knead space and save to Supabase
  const handleCreateSpace = async () => {
    if (!window.ethereum || !isAgentConnected) {
      alert('Please connect your wallet first');
      return;
    }

    setCreatingSpace(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();

      console.log('Creating Knead space...');
      const result = await createSpace({ spaceName: 'Knead' }, signer);
      
      console.log('✅ Knead space created:', result);
      
      // Save to Supabase (global storage)
      const { error: insertError } = await supabase
        .from('towns_spaces')
        .insert({
          space_id: result.spaceId,
          space_name: 'Knead',
          default_channel_id: result.defaultChannelId,
          created_by: account?.address,
          is_active: true,
        });

      if (insertError) {
        console.error('Failed to save space to Supabase:', insertError);
        // Still set the IDs locally if Supabase fails
      } else {
        console.log('✅ Space saved to Supabase');
      }
      
      setSpaceId(result.spaceId);
      setDefaultChannelId(result.defaultChannelId);
    } catch (err) {
      console.error('Failed to create space:', err);
      alert('Failed to create Knead space. Check console for details.');
    } finally {
      setCreatingSpace(false);
    }
  };

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

  // Connected but no space - need to create one
  if (!spaceId || !defaultChannelId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="font-adonis text-4xl mb-4">Create Knead Space</h1>
          <p className="font-georgia-pro text-gray-600 mb-2">
            No Knead space exists yet. Create one to start the community!
          </p>
          <p className="font-georgia-pro text-sm text-gray-500 mb-6">
            This only needs to be done once - all users will join this space.
          </p>
          {creatingSpace || isCreatingSpace ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
              <p className="font-georgia-pro text-gray-600">
                Creating space... Please confirm the transaction in your wallet.
              </p>
            </>
          ) : (
            <button
              onClick={handleCreateSpace}
              className="px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
            >
              Create Knead Space
            </button>
          )}
        </div>
      </div>
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
