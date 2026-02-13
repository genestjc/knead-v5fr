'use client';

import { useEffect, useRef } from 'react';
import { useAgentConnection } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { useActiveAccount } from 'thirdweb/react';
import { createTownsSigner } from '@/lib/towns-signer-adapter';
import { client, activeChain } from '@/thirdweb-client';

const townsConfig = townsEnv().makeTownsConfig('omega');

/**
 * Hook to automatically connect/disconnect Towns agent when wallet changes
 * 
 * Uses ThirdWeb → ethers v5 adapter
 * Supports MetaMask, Coinbase Wallet, social logins, etc.
 */
export function useTownsAgent() {
  const { connect, disconnect, isAgentConnected, isAgentConnecting } = useAgentConnection();
  
  // ✅ ThirdWeb hooks (supports all wallet types)
  const activeAccount = useActiveAccount();
  
  const hasConnectedRef = useRef(false);
  const previousAddressRef = useRef<string | undefined>();
  const isConnectingRef = useRef(false);

  useEffect(() => {
    async function connectAgent() {
      // Early returns
      if (!activeAccount) {
        return;
      }

      const address = activeAccount.address;

      // Skip if already connected to the same address
      if (hasConnectedRef.current && previousAddressRef.current === address) {
        return;
      }

      // Prevent duplicate calls during connection
      if (isAgentConnecting || isConnectingRef.current) {
        console.log('⏳ Connection already in progress, skipping...');
        return;
      }

      // Handle wallet address change
      if (previousAddressRef.current && previousAddressRef.current !== address) {
        console.log('🔄 Wallet changed, disconnecting old session...');
        disconnect?.();
        hasConnectedRef.current = false;
      }

      isConnectingRef.current = true;

      try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔌 CONNECTING TOWNS SYNC AGENT');
        console.log('   Wallet:', address);
        console.log('   Chain:', activeChain.name, `(${activeChain.id})`);
        console.log('   Method: ThirdWeb → ethers v5');
        console.log('   Supports: MetaMask, Coinbase, Social Login');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Create ethers v5 signer from ThirdWeb account
        const signer = await createTownsSigner(activeAccount, client, activeChain);
        
        // Verify signer address matches
        const signerAddress = await signer.getAddress();
        console.log('✅ Signer verification:');
        console.log('   ThirdWeb address:', address);
        console.log('   Signer address:', signerAddress);
        console.log('   Match:', signerAddress.toLowerCase() === address.toLowerCase());

        if (signerAddress.toLowerCase() !== address.toLowerCase()) {
          throw new Error(`Signer mismatch! Expected ${address}, got ${signerAddress}`);
        }

        // ✅ Connect to Towns Protocol with token expiry handler
        console.log('🔐 Creating delegate key session...');
        await connect(signer, { 
          townsConfig,
          onTokenExpired: () => {
            console.log('━���━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('⚠️ TOWNS DELEGATE TOKEN EXPIRED');
            console.log('   Your session has expired');
            console.log('   Admin functions (delete, etc.) will fail');
            console.log('   Action: Refresh the page to reconnect');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            // Reset connection state
            hasConnectedRef.current = false;
            isConnectingRef.current = false;
            
            // Show user alert
            alert(
              '⚠️ Your Towns session has expired.\n\n' +
              'Admin functions (like deleting messages) will not work until you reconnect.\n\n' +
              'Please refresh the page to create a new session.'
            );
          }
        });
        
        hasConnectedRef.current = true;
        previousAddressRef.current = address;
        
        console.log('✅ SUCCESS! Towns sync agent connected');
        console.log('   Delegate key session established');
        console.log('   Session valid for: 30 days');
        console.log('   Connected at:', new Date().toISOString());
        console.log('   Ready for all Towns operations');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
      } catch (error: any) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ FAILED TO CONNECT TOWNS AGENT');
        console.error('   Error:', error.message);
        console.error('   Error name:', error.name);
        
        // Better error diagnosis
        if (error.message?.includes('signMessage')) {
          console.error('   → Issue: Wallet signature failed');
          console.error('   → Action: User may have rejected signature request');
        } else if (error.message?.includes('network')) {
          console.error('   → Issue: Network connectivity problem');
          console.error('   → Action: Check internet connection or RPC endpoint');
        } else if (error.message?.includes('mismatch')) {
          console.error('   → Issue: Address mismatch between ThirdWeb and signer');
          console.error('   → Action: Wallet may have switched during connection');
        }
        
        console.error('   Stack:', error.stack);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        hasConnectedRef.current = false;
      } finally {
        isConnectingRef.current = false;
      }
    }

    connectAgent();

    return () => {
      if (!activeAccount && hasConnectedRef.current) {
        console.log('🔌 Wallet disconnected - disconnecting Towns agent');
        disconnect?.();
        hasConnectedRef.current = false;
        previousAddressRef.current = undefined;
        isConnectingRef.current = false;
      }
    };
  }, [activeAccount, isAgentConnecting, connect, disconnect]);

  // Health check
  useEffect(() => {
    if (!isAgentConnected || !activeAccount) return;

    const healthCheckInterval = setInterval(() => {
      if (!isAgentConnected && activeAccount) {
        console.warn('⚠️ Towns agent disconnected unexpectedly - triggering reconnect...');
        hasConnectedRef.current = false;
        isConnectingRef.current = false;
      }
    }, 60 * 1000);

    return () => clearInterval(healthCheckInterval);
  }, [isAgentConnected, activeAccount]);

  return {
    isAgentConnected,
    isAgentConnecting,
  };
}
