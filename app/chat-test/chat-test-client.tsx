'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount, useActiveWalletConnectionStatus } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';
import { useAgentConnection, useCreateSpace } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import type { ChatUser } from '@/types/chat';
import nextDynamic from 'next/dynamic';
import { ethers } from 'ethers-v5';

// Dynamically import the connected chat component
const ConnectedChat = nextDynamic(() => import('./connected-chat'), {
  ssr: false,
});

// Towns Protocol environment config
const townsConfig = townsEnv().makeTownsConfig('gamma');
const KNEAD_SPACE_KEY = 'knead_space_id';
const KNEAD_DEFAULT_CHANNEL_KEY = 'knead_default_channel_id';

export default function ChatTestClient() {
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [defaultChannelId, setDefaultChannelId] = useState<string | null>(null);
  const [creatingSpace, setCreatingSpace] = useState(false);
  const account = useActiveAccount();
  const connectionStatus = useActiveWalletConnectionStatus();

  // Only call useAgentConnection - no other Towns hooks yet
  const { connect, disconnect, isAgentConnecting, isAgentConnected } = useAgentConnection();
  const { createSpace, isPending: isCreatingSpace } = useCreateSpace();

  // Check for existing space in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSpaceId = localStorage.getItem(KNEAD_SPACE_KEY);
      const savedChannelId = localStorage.getItem(KNEAD_DEFAULT_CHANNEL_KEY);
      if (savedSpaceId && savedChannelId) {
        setSpaceId(savedSpaceId);
        setDefaultChannelId(savedChannelId);
      }
    }
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
        // Check if ethereum provider exists
        if (typeof window === 'undefined' || !window.ethereum) {
          console.error('No ethereum provider found');
          return;
        }

        // Use ethers v5 to create provider from window.ethereum
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

  // Create Knead space after connection if it doesn't exist
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
      
      // Save to localStorage
      localStorage.setItem(KNEAD_SPACE_KEY, result.spaceId);
      localStorage.setItem(KNEAD_DEFAULT_CHANNEL_KEY, result.defaultChannelId);
      
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
  if (loading) {
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
          <p className="font-georgia-pro text-gray-600 mb-6">
            First, we need to create a Knead space on Towns Protocol. This is a one-time setup.
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
