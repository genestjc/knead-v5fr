'use client';

import { type Account, type Chain, type Client, type Transport } from 'viem';
import { type Config, useConnectorClient } from 'wagmi';
import { useMemo } from 'react';
import type { Signer } from 'ethers-v5';

export function clientToProvider(client: Client<Transport, Chain>) {
  // Dynamic import of ethers v5
  return import('ethers-v5').then(({ ethers }) => {
    const { chain, transport } = client;
    const network = {
      chainId: chain.id,
      name: chain.name,
      ensAddress: chain.contracts?.ensRegistry?.address,
    };
    if (transport.type === 'fallback') {
      return new ethers.providers.Web3Provider(transport.transports[0].value, network);
    }
    return new ethers.providers.Web3Provider(transport, network);
  });
}

export function clientToSigner(client: Client<Transport, Chain, Account>): Promise<Signer> {
  // Dynamic import of ethers v5
  return import('ethers-v5').then(({ ethers }) => {
    const { account, chain, transport } = client;
    const network = {
      chainId: chain.id,
      name: chain.name,
      ensAddress: chain.contracts?.ensRegistry?.address,
    };
    const provider = new ethers.providers.Web3Provider(transport, network);
    return provider.getSigner(account.address);
  });
}

/** Hook to convert a Viem Client to an ethers.js v5 Signer */
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: client } = useConnectorClient<Config>({ chainId });
  return useMemo(() => (client ? clientToSigner(client) : undefined), [client]);
}
