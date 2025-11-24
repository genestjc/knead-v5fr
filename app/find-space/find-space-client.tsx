'use client'; // This component will only run on the client

import { useAgentConnection, useUserSpaces } from '@towns-protocol/react-sdk';

export default function FindSpaceClientComponent() {
  const { isConnected } = useAgentConnection();
  const { data: spaces, isLoading, error } = useUserSpaces();

  // Show a message if the user's wallet/agent isn't connected yet
  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">Find Your Spaces</h1>
        <p>Please connect your wallet and agent to see your spaces.</p>
      </div>
    );
  }

  // Show loading/error states while fetching the user's spaces
  if (isLoading) {
    return <div className="text-center p-8">Loading your spaces...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">Error loading spaces: {error.message}</div>;
  }

  // If everything is successful, display the list of joined spaces
  return (
    <div className="container mx-auto px-4 py-8">
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
    </div>
  );
}
