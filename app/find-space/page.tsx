'use client';

// CORRECTED: Import useAgentConnection instead of useAgent
import { useAgentConnection, useUserSpaces } from '@towns-protocol/react-sdk'; 

// Required to prevent static generation errors with Towns hooks
export const dynamic = 'force-dynamic';

export default function FindSpacePage() {
  // CORRECTED: Use the correct hook to check connection status
  const { isConnected } = useAgentConnection();
  
  // This hook correctly fetches the spaces for the connected user
  const { data: spaces, isLoading, error } = useUserSpaces();

  // First, check if the agent is connected before trying to show spaces
  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">Find Your Spaces</h1>
        <p>Please connect your wallet and agent to see your spaces.</p>
      </div>
    );
  }

  // If connected, show loading/error/data states for the user's spaces
  if (isLoading) {
    return <div className="text-center p-8">Loading your spaces...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">Error loading spaces: {error.message}</div>;
  }

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
