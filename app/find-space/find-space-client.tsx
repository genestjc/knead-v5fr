'use client';

import { useAgentConnection, useUserSpaces } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { useEthersSigner } from '@/lib/utils/viem-to-ethers'; // Import our new utility
import { Button } from '@/components/ui/button'; // Assuming you have a button component

// This component will only render AFTER a connection is made
function ShowUserSpaces() {
  const { data: spaces, isLoading, error } = useUserSpaces();

  if (isLoading) {
    return <div className="text-center p-8">Loading your spaces...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">Error loading spaces: {error.message}</div>;
  }

  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Your Joined Spaces</h1>
      {spaces && spaces.length > 0 ? (
        <ul className="space-y-4">
          {spaces.map((space) => (
            <li key={space.id} className="p-4 border rounded-lg shadow">
              <h2 className="text-xl font-semibold">{space.name}</h2>
              <p className="text-gray-600">{space.description}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>You haven't joined any spaces yet.</p>
      )}
    </>
  );
}

// This is the main component for the page
export default function FindSpaceClientComponent() {
  const { connect, isConnected, isAgentConnecting } = useAgentConnection();
  const signer = useEthersSigner();
  
  // As per the docs, we need to create a config
  const townsConfig = townsEnv().makeTownsConfig('gamma');

  const handleConnect = async () => {
    if (!signer) {
      alert('Please connect your web3 wallet first.');
      return;
    }
    try {
      await connect(signer, { townsConfig });
    } catch (e) {
      console.error('Failed to connect to Towns:', e);
      alert('Failed to connect to Towns. See console for details.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* If connected, show the spaces. If not, show the connect UI. */}
      {isConnected ? (
        <ShowUserSpaces />
      ) : (
        <div>
          <h1 className="text-3xl font-bold mb-4">Connect to Towns</h1>
          <p className="mb-4">To see your spaces, you need to connect to the Towns Protocol.</p>
          <Button onClick={handleConnect} disabled={isAgentConnecting || !signer}>
            {isAgentConnecting ? 'Connecting...' : 'Connect to Towns'}
          </Button>
          {!signer && <p className="text-sm text-gray-500 mt-2">Please connect your wallet first.</p>}
        </div>
      )}
    </div>
  );
}
