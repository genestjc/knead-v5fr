import type { Account } from "thirdweb/wallets";
import type { ThirdwebClient } from "thirdweb";
import type { Chain } from "thirdweb/chains";
import { ethers } from "ethers-v5";

export async function createTownsSigner(
  account: Account,
  client: ThirdwebClient,
  chain: Chain,
): Promise<ethers.Signer> {
  // ✅ DEBUG: Log wallet details
  console.log('🔍 Creating signer for account:', account.address);
  console.log('🔍 Chain:', chain.id, chain.name);
  console.log('🔍 Window ethereum available:', typeof window !== 'undefined' && !!window.ethereum);
  
  const provider = new ethers.providers.JsonRpcProvider(chain.rpc, {
    chainId: chain.id,
    name: chain.name || "unknown",
  });

  const signer = {
    getAddress: async () => account.address,
    signMessage: async (message: string | Uint8Array) => {
      try {
        console.log('🔍 Signing message...');
        console.log('🔍 Message type:', typeof message);
        
        const sig = await account.signMessage({
          message:
            typeof message === "string" ? message : ethers.utils.hexlify(message),
        });
        
        console.log('✅ Message signed successfully');
        console.log('🔍 Signature:', sig.substring(0, 20) + '...');
        return sig;
      } catch (error) {
        console.error('❌ Signature failed:', error);
        throw error;
      }
    },
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

  console.log('✅ Signer created');
  return signer as unknown as ethers.Signer;
}
