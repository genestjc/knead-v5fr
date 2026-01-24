// lib/viem-to-ethers.ts
import { providers } from "ethers-v5";
import type { Account, Chain, Client, Transport } from "viem";
import type { Wallet } from "thirdweb/wallets";

/**
 * Official Wagmi implementation for Viem -> Ethers v5
 * From: https://wagmi.sh/core/guides/ethers#reference-implementation
 */
export function walletClientToSigner(
  walletClient: Client<Transport, Chain, Account>,
) {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account.address);
  return signer;
}

/**
 * Alternative: Create a custom EIP-1193 provider from ThirdWeb wallet
 * Use this if the above doesn't work due to transport compatibility
 */
export function createEIP1193Provider(walletClient: Client<Transport, Chain, Account>) {
  const { account, transport } = walletClient;
  
  // Create a minimal EIP-1193 compatible provider
  return {
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      if (method === 'eth_accounts') {
        return [account.address];
      }
      if (method === 'eth_chainId') {
        return `0x${walletClient.chain.id.toString(16)}`;
      }
      // Delegate to the underlying transport
      return transport.request({ method, params });
    },
    // Add other required EIP-1193 methods
    on: () => {},
    removeListener: () => {},
  };
}
