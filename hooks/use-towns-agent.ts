'use client';

import { useEffect, useRef } from 'react';
import { useAgentConnection } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import {
  useActiveAccount,
  useActiveWallet,
  useActiveWalletChain,
} from 'thirdweb/react';

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
        console.log('   Source: ThirdWeb wallet → ethers v5');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // ✅ CRITICAL: Get ThirdWeb's provider, but create ethers v5 signer
        // ThirdWeb's getSigner() returns v6, but Towns needs v5!
        
        // Import ethers v5 (using your alias)
        const { providers } = await import('ethers-v5');
        
        // Get the raw provider from ThirdWeb wallet
        // This works for MetaMask, WalletConnect, Coinbase, etc.
        const ethersProvider = await activeWallet.getEthersProvider();
        
        // Wrap it in ethers v5 Web3Provider
        const web3Provider = new providers.Web3Provider(ethersProvider);
        
        // Get the v5 signer
        const signer = web3Provider.getSigner(address);

        console.log('✅ Ethers v5 signer created from ThirdWeb wallet');
        console.log('   Signer address:', await signer.getAddress());
        console.log('   Signer type: ethers v5 JsonRpcSigner');

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

    return () => {
      if (!activeAccount && hasConnectedRef.current) {
        console.log('🔌 Wallet disconnected - disconnecting Towns agent');
        disconnect?.();
        hasConnectedRef.current = false;
        previousAddressRef.current = undefined;
      }
    };
  }, [activeAccount, activeWallet, activeChain, isAgentConnecting, connect, disconnect]);

  return { isAgentConnected, isAgentConnecting };
}
