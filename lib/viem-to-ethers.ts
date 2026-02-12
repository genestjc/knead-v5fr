'use client';

import { type Account, type Chain, type Client, type Transport } from 'viem';
import { type Config, useConnectorClient } from 'wagmi';
import { useMemo } from 'react';
import type { Signer } from 'ethers-v5';

async function transportToProvider(transport: any, network: any) {
  const { ethers } = await import('ethers-v5');
  
  if (transport.type === 'fallback') {
    if (!transport.transports || transport.transports.length === 0) {
      throw new Error('Fallback transport has no transports configured');
    }
    return new ethers.providers.Web3Provider(transport.transports[0].value, network);
  }
  return new ethers.providers.Web3Provider(transport, network);
}

export function clientToProvider(client: Client<Transport, Chain>) {
  return import('ethers-v5').then(async ({ ethers }) => {
    const { chain, transport } = client;
    const network = {
      chainId: chain.id,
      name: chain.name,
      ensAddress: chain.contracts?.ensRegistry?.address,
    };
    return await transportToProvider(transport, network);
  });
}

export function clientToSigner(client: Client<Transport, Chain, Account>): Promise<Signer> {
  return import('ethers-v5').then(async ({ ethers }) => {
    const { account, chain, transport } = client;
    const network = {
      chainId: chain.id,
      name: chain.name,
      ensAddress: chain.contracts?.ensRegistry?.address,
    };
    const provider = await transportToProvider(transport, network);
    return provider.getSigner(account.address);
  });
}

/** Hook to convert a Viem Client to an ethers.js v5 Signer */
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: client } = useConnectorClient<Config>({ chainId });
  return useMemo(() => (client ? clientToSigner(client) : undefined), [client]);
}
