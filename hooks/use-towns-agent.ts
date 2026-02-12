'use client';

import { useEffect, useRef } from 'react';
import { useAgentConnection } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { useEthersSigner } from '@/lib/viem-to-ethers';
import { useAccount } from 'wagmi';
import { base } from 'wagmi/chains';

export function useTownsAgent() {
  const { connect, disconnect, isAgentConnected, isAgentConnecting } = useAgentConnection();
  const { address, isConnected } = useAccount();
  const signer = useEthersSigner({ chainId: base.id });
  
  const hasConnectedRef = useRef(false);
  const previousAddressRef = useRef<string | undefined>();

  useEffect(() => {
    async function connectAgent() {
      if (!isConnected || !address || !signer) return;
      if (hasConnectedRef.current && previousAddressRef.current === address) return;
      if (isAgentConnecting) return;

      if (previousAddressRef.current && previousAddressRef.current !== address) {
        console.log('🔄 Wallet changed, disconnecting old session...');
        disconnect?.();
        hasConnectedRef.current = false;
      }

      try {
        console.log('🔌 Connecting Towns agent with ethers v5 signer...');
        const townsConfig = townsEnv().makeTownsConfig('omega');
        await connect(signer, { townsConfig });
        hasConnectedRef.current = true;
        previousAddressRef.current = address;
        console.log('✅ Towns agent connected successfully');
      } catch (error: any) {
        console.error('❌ Failed to connect Towns agent:', error.message);
        hasConnectedRef.current = false;
      }
    }

    connectAgent();

    return () => {
      if (!isConnected && hasConnectedRef.current) {
        disconnect?.();
        hasConnectedRef.current = false;
        previousAddressRef.current = undefined;
      }
    };
  }, [isConnected, address, signer, isAgentConnecting, connect, disconnect]);

  return { isAgentConnected, isAgentConnecting };
}
