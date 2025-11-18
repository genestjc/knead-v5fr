/**
 * Towns Protocol Client using Web3 Wallet Authentication
 * 
 * This module provides Towns Protocol integration WITHOUT API keys.
 * Instead, it uses Web3 wallet signatures for authentication.
 * 
 * Key features:
 * - useTownsConnection: React hook for client-side Web3 auth
 * - getTownsBearerToken: Server-side read-only access via API endpoint
 */

'use client';

// Note: @towns/react package should be installed (@towns-protocol/react-sdk)
// If not available, this will need to be implemented when the package is ready

/**
 * React hook for Towns Protocol connection using Web3 wallet auth
 * 
 * This replaces the old API key-based authentication with wallet signatures.
 * 
 * @returns Connection state and methods
 */
export function useTownsConnection() {
  // TODO: Implement when @towns/react package exports useAgentConnection
  // For now, return a stub that can be implemented later
  
  // Implementation should look like:
  // import { useAgentConnection } from '@towns/react';
  // import { useActiveAccount } from 'thirdweb/react'; // use your existing wallet hook
  // 
  // const account = useActiveAccount();
  // const signer = account?.getSigner(); // or similar method to get signer
  // 
  // const { connect, disconnect, isConnected, agent } = useAgentConnection({
  //   signer, // Use wallet signer for Web3 auth
  // });

  const connect = async () => {
    console.log('[Towns] Connecting with Web3 wallet auth...');
    // Connect using wallet signer instead of API key
  };

  const disconnect = () => {
    console.log('[Towns] Disconnecting...');
  };

  return {
    connect,
    disconnect,
    isConnected: false,
    agent: null,
  };
}

/**
 * Get Towns bearer token for server-side read-only access
 * 
 * This is used for fetching data without wallet signatures.
 * The token is obtained from the server-side API endpoint.
 * 
 * @param walletAddress - User's wallet address
 * @returns Bearer token string
 */
export async function getTownsBearerToken(walletAddress: string): Promise<string> {
  try {
    // Fetch from server-side endpoint that generates read-only tokens
    const response = await fetch(`/api/towns/auth?address=${walletAddress}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get Towns bearer token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('[Towns] Error getting bearer token:', error);
    throw error;
  }
}
