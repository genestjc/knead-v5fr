import type { Account } from "thirdweb/wallets";
import type { ThirdwebClient } from "thirdweb";
import type { Chain } from "thirdweb/chains";
import { ethers } from "ethers-v5"; // Use your ethers v5 alias

/**
 * Creates an ethers v5 Signer from a Thirdweb Account
 * Compatible with Towns Protocol (which requires ethers v5)
 */
export async function createTownsSigner(
  account: Account,
  client: ThirdwebClient,
  chain: Chain,
): Promise<ethers.Signer> {
  const provider = new ethers.providers.JsonRpcProvider(chain.rpc, {
    chainId: chain.id,
    name: chain.name || "unknown",
  });

  const signer = {
    getAddress: async () => account.address,
    
    signMessage: async (message: string | Uint8Array) =>
      account.signMessage({
        message:
          typeof message === "string" ? message : ethers.utils.hexlify(message),
      }),
    
    signTransaction: async () => {
      throw new Error(
        "signTransaction not implemented - Towns Protocol uses signMessage",
      );
    },
    
    sendTransaction: async () => {
      throw new Error(
        "sendTransaction not implemented - Towns Protocol uses signMessage",
      );
    },
    
    connect: (_provider: ethers.providers.Provider) => signer,
    
    getChainId: async () => chain.id,
    
    getBalance: async (blockTag?: string) =>
      provider.getBalance(account.address, blockTag),
    
    getTransactionCount: async (blockTag?: string) =>
      provider.getTransactionCount(account.address, blockTag),
    
    estimateGas: async (tx: ethers.providers.TransactionRequest) =>
      provider.estimateGas(tx),
    
    call: async (tx: ethers.providers.TransactionRequest, blockTag?: string) =>
      provider.call(tx, blockTag),
    
    getGasPrice: async () => provider.getGasPrice(),
    
    resolveName: async (name: string) => provider.resolveName(name),
    
    provider,
    _isSigner: true,
  };

  return signer as unknown as ethers.Signer;
}
