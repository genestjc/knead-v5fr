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

        // Connect to Towns Protocol
        await connect(signer, { townsConfig });
        
        hasConnectedRef.current = true;
        previousAddressRef.current = address;
        
        console.log('✅ SUCCESS! Towns sync agent connected');
        console.log('   Delegate key session established');
        console.log('   Ready for all Towns operations');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
      } catch (error: any) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ FAILED TO CONNECT TOWNS AGENT');
        console.error('   Error:', error.message);
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
