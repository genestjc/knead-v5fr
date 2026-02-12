'use client';

import { useEffect, useRef } from 'react';
import { useAgentConnection } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { ethers5Adapter } from 'thirdweb/adapters/ethers5';
import { client } from '@/thirdweb-client'; // Your ThirdWeb client
import { base } from 'thirdweb/chains';

/**
 * Hook to automatically connect/disconnect Towns agent when wallet changes
 * 
 * CRITICAL: Uses ThirdWeb → ethers v5 adapter for proper signature compatibility
 */
export function useTownsAgent() {
  const { connect, disconnect, isAgentConnected, isAgentConnecting } = useAgentConnection();
  
  // ✅ Get ThirdWeb account and wallet
  const activeAccount = useActiveAccount();
  const wallet = useActiveWallet();
  
  // ✅ Track connection state with ref to avoid stale closures
  const hasConnectedRef = useRef(false);
  const previousAddressRef = useRef<string | undefined>();

  useEffect(() => {
    async function connectAgent() {
      // Skip if no wallet connected
      if (!activeAccount || !wallet) {
        return;
      }

      const address = activeAccount.address;

      // Skip if already connected to the same address
      if (hasConnectedRef.current && previousAddressRef.current === address) {
        return;
      }

      // Skip if already connecting
      if (isAgentConnecting) {
        return;
      }

      // ✅ If address changed, disconnect old session first
      if (previousAddressRef.current && previousAddressRef.current !== address) {
        console.log('🔄 Wallet changed, disconnecting old session...');
        disconnect?.();
        hasConnectedRef.current = false;
      }

      try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔌 CONNECTING TOWNS SYNC AGENT');
        console.log('   Wallet:', address);
        console.log('   Chain: Base (omega/mainnet)');
        console.log('   Using: ThirdWeb → ethers v5 adapter');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // ✅ Convert ThirdWeb account to ethers v5 signer
        const signer = await ethers5Adapter.signer.toEthers({
          client,
          chain: base,
          account: activeAccount,
        });

        console.log('✅ Ethers v5 signer created from ThirdWeb account');
        console.log('   Signer address:', await signer.getAddress());

        // ✅ Connect to Towns Protocol omega (Base mainnet)
        const townsConfig = townsEnv().makeTownsConfig('omega');
        
        await connect(signer, { townsConfig });
        
        hasConnectedRef.current = true;
        previousAddressRef.current = address;
        
        console.log('✅ Towns sync agent connected successfully');
        console.log('   Delegate key session established');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
      } catch (error: any) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ FAILED TO CONNECT TOWNS AGENT');
        console.error('   Error:', error.message);
        console.error('   Stack:', error.stack);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        hasConnectedRef.current = false;
      }
    }

    connectAgent();

    // ✅ Cleanup: disconnect when wallet disconnects
    return () => {
      if (!activeAccount && hasConnectedRef.current) {
        console.log('🔌 Wallet disconnected - disconnecting Towns agent');
        disconnect?.();
        hasConnectedRef.current = false;
        previousAddressRef.current = undefined;
      }
    };
  }, [activeAccount, wallet, isAgentConnecting, connect, disconnect]);

  // ✅ Periodic health check - reconnect if session drops
  useEffect(() => {
    if (!isAgentConnected || !activeAccount) return;

    const healthCheckInterval = setInterval(() => {
      // If agent disconnected but wallet still connected, trigger reconnect
      if (!isAgentConnected && activeAccount && wallet) {
        console.warn('⚠️ Towns agent disconnected - triggering reconnect...');
        hasConnectedRef.current = false; // Allow reconnection
      }
    }, 60 * 1000); // Check every 60 seconds

    return () => clearInterval(healthCheckInterval);
  }, [isAgentConnected, activeAccount, wallet]);

  return {
    isAgentConnected,
    isAgentConnecting,
  };
}
