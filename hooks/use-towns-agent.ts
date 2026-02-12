'use client';

import { useEffect, useRef } from 'react';
import { useAgentConnection } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { useEthersSigner } from '@/lib/viem-to-ethers';
import { useAccount } from 'wagmi';
import { base } from 'wagmi/chains';

// ✅ Create config outside component to avoid re-creation (Towns bot suggestion)
const townsConfig = townsEnv().makeTownsConfig('omega');

/**
 * Hook to automatically connect/disconnect Towns agent when wallet changes
 * 
 * Uses Wagmi → ethers v5 adapter (officially recommended by Towns)
 * Includes safeguards against race conditions and duplicate connections
 */
export function useTownsAgent() {
  const { connect, disconnect, isAgentConnected, isAgentConnecting } = useAgentConnection();
  
  // ✅ Wagmi hooks (recommended by Towns)
  const { address, isConnected } = useAccount();
  const signer = useEthersSigner({ chainId: base.id });
  
  const hasConnectedRef = useRef(false);
  const previousAddressRef = useRef<string | undefined>();
  const isConnectingRef = useRef(false); // ✅ Lock to prevent race conditions

  useEffect(() => {
    async function connectAgent() {
      // ✅ Early returns for invalid states
      if (!isConnected || !address) {
        return;
      }

      // ✅ ThirdWeb bot suggestion: Check for undefined signer
      if (!signer) {
        console.warn('⚠️ Wagmi signer not ready yet, waiting...');
        return;
      }

      // ✅ Skip if already connected to the same address
      if (hasConnectedRef.current && previousAddressRef.current === address) {
        return;
      }

      // ✅ Towns bot suggestion: Prevent duplicate calls during connection
      if (isAgentConnecting || isConnectingRef.current) {
        console.log('⏳ Connection already in progress, skipping...');
        return;
      }

      // ✅ Handle wallet address change
      if (previousAddressRef.current && previousAddressRef.current !== address) {
        console.log('🔄 Wallet changed, disconnecting old session...');
        disconnect?.();
        hasConnectedRef.current = false;
      }

      // ✅ Set lock before starting connection
      isConnectingRef.current = true;

      try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔌 CONNECTING TOWNS SYNC AGENT');
        console.log('   Wallet:', address);
        console.log('   Chain: Base (omega/mainnet)');
        console.log('   Method: Wagmi → ethers v5 (official)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // ✅ Verify signer address matches (safety check)
        const signerAddress = await signer.getAddress();
        console.log('✅ Signer verification:');
        console.log('   Wagmi address:', address);
        console.log('   Signer address:', signerAddress);
        console.log('   Match:', signerAddress.toLowerCase() === address.toLowerCase());

        if (signerAddress.toLowerCase() !== address.toLowerCase()) {
          throw new Error(`Signer mismatch! Expected ${address}, got ${signerAddress}`);
        }

        // ✅ Connect to Towns (config created outside component)
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
        // ✅ Always release lock
        isConnectingRef.current = false;
      }
    }

    connectAgent();

    // ✅ Cleanup on wallet disconnect
    return () => {
      if (!isConnected && hasConnectedRef.current) {
        console.log('🔌 Wallet disconnected - disconnecting Towns agent');
        disconnect?.();
        hasConnectedRef.current = false;
        previousAddressRef.current = undefined;
        isConnectingRef.current = false;
      }
    };
  }, [isConnected, address, signer, isAgentConnecting, connect, disconnect]);

  // ✅ Health check (optional, but good for production)
  useEffect(() => {
    if (!isAgentConnected || !isConnected) return;

    const healthCheckInterval = setInterval(() => {
      if (!isAgentConnected && isConnected && address && signer) {
        console.warn('⚠️ Towns agent disconnected unexpectedly - triggering reconnect...');
        hasConnectedRef.current = false;
        isConnectingRef.current = false;
      }
    }, 60 * 1000); // Check every 60 seconds

    return () => clearInterval(healthCheckInterval);
  }, [isAgentConnected, isConnected, address, signer]);

  return {
    isAgentConnected,
    isAgentConnecting,
  };
}
