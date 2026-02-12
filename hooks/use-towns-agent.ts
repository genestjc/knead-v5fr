'use client';

import { useEffect, useRef } from 'react';
import { useAgentConnection } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import {
  useActiveAccount,
  useActiveWallet,
  useActiveWalletChain,
} from 'thirdweb/react';
import { providers as v5Providers } from 'ethers-v5'; // ✅ Your v5 alias

/**
 * Hook to automatically connect/disconnect Towns agent when wallet changes
 * 
 * CRITICAL: Converts ThirdWeb's ethers v6 signer → ethers v5 for Towns SDK compatibility
 * Based on official ThirdWeb guidance for v5/v6 compatibility
 */
export function useTownsAgent() {
  const { connect, disconnect, isAgentConnected, isAgentConnecting } = useAgentConnection();
  const activeAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const activeChain = useActiveWalletChain();

  const hasConnectedRef = useRef(false);
  const previousAddressRef = useRef<string | undefined>();

  useEffect(() => {
    async function connectAgent() {
      if (!activeAccount || !activeWallet || !activeChain) return;

      const address = activeAccount.address;

      if (hasConnectedRef.current && previousAddressRef.current === address) return;
      if (isAgentConnecting) return;

      if (previousAddressRef.current && previousAddressRef.current !== address) {
        console.log('🔄 Wallet changed, disconnecting old session...');
        disconnect?.();
        hasConnectedRef.current = false;
      }

      try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔌 CONNECTING TOWNS SYNC AGENT');
        console.log('   Wallet:', address);
        console.log('   Chain:', activeChain.name);
        console.log('   Method: ThirdWeb v6 → ethers v5 conversion');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // ✅ STEP 1: Get v6 signer from ThirdWeb (correct account)
        const v6Signer = await activeWallet.getSigner();
        
        if (!v6Signer) {
          throw new Error('No signer available from ThirdWeb wallet');
        }

        console.log('✅ Step 1: Got v6 signer from ThirdWeb');
        console.log('   v6 Signer address:', await v6Signer.getAddress());

        // ✅ STEP 2: Extract underlying provider from v6 signer
        // This gets the raw provider (MetaMask, WalletConnect, etc.)
        const provider = v6Signer.provider?.provider || window.ethereum;
        
        if (!provider) {
          throw new Error('No provider available from v6 signer');
        }

        console.log('✅ Step 2: Extracted underlying provider');

        // ✅ STEP 3: Create v5 Web3Provider from raw provider
        const v5Provider = new v5Providers.Web3Provider(provider);

        console.log('✅ Step 3: Created v5 Web3Provider');

        // ✅ STEP 4: Get v5 signer for the correct address
        const v5Signer = v5Provider.getSigner(await v6Signer.getAddress());

        console.log('✅ Step 4: Created v5 signer');
        console.log('   v5 Signer address:', await v5Signer.getAddress());
        console.log('   Addresses match?:', (await v5Signer.getAddress()).toLowerCase() === address.toLowerCase());

        // ✅ VERIFICATION: Ensure addresses match
        if ((await v5Signer.getAddress()).toLowerCase() !== address.toLowerCase()) {
          throw new Error(`Address mismatch! v5 Signer: ${await v5Signer.getAddress()}, Expected: ${address}`);
        }

        // ✅ STEP 5: Connect to Towns with v5 signer
        const townsConfig = townsEnv().makeTownsConfig('omega');
        
        console.log('🔄 Connecting to Towns Protocol...');
        await connect(v5Signer, { townsConfig });

        hasConnectedRef.current = true;
        previousAddressRef.current = address;

        console.log('✅ SUCCESS! Towns sync agent connected');
        console.log('   Delegate key session established');
        console.log('   v6 → v5 conversion successful');
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

    return () => {
      if (!activeAccount && hasConnectedRef.current) {
        console.log('🔌 Wallet disconnected - disconnecting Towns agent');
        disconnect?.();
        hasConnectedRef.current = false;
        previousAddressRef.current = undefined;
      }
    };
  }, [activeAccount, activeWallet, activeChain, isAgentConnecting, connect, disconnect]);

  // ✅ Periodic health check - reconnect if session drops
  useEffect(() => {
    if (!isAgentConnected || !activeAccount) return;

    const healthCheckInterval = setInterval(() => {
      if (!isAgentConnected && activeAccount && activeWallet) {
        console.warn('⚠️ Towns agent disconnected - triggering reconnect...');
        hasConnectedRef.current = false;
      }
    }, 60 * 1000);

    return () => clearInterval(healthCheckInterval);
  }, [isAgentConnected, activeAccount, activeWallet]);

  return {
    isAgentConnected,
    isAgentConnecting,
  };
}
