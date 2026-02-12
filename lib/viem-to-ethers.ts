/**
 * Adapter to convert Wagmi/Viem wallet client to ethers.js v5 Signer
 * 
 * CRITICAL: Must use ethers v5, NOT v6!
 * Towns SDK requires v5 Signer for delegate key signatures.
 * 
 * Source: https://wagmi.sh/react/guides/ethers#usage-1
 */

import { useMemo } from 'react';
import { providers } from 'ethers-v5';
import type { Account, Chain, Client, Transport } from 'viem';
import { type Config, useConnectorClient } from 'wagmi';

export function clientToSigner(client: Client<Transport, Chain, Account>) {
  const { account, chain, transport } = client;
  
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  
  const provider = new providers.Web3Provider(transport, network);
  return provider.getSigner(account.address);
}

/** 
 * Hook to convert the connected Wagmi client to an ethers.js v5 Signer
 * 
 * ✅ Memoized to ensure stable reference (ThirdWeb bot suggestion)
 */
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: client } = useConnectorClient<Config>({ chainId });
  
  // ✅ Memoize signer to prevent unnecessary re-renders
  return useMemo(
    () => (client ? clientToSigner(client) : undefined),
    [client]
  );
}
