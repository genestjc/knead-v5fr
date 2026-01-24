// lib/ethers-signer-adapter.ts
'use client';

/**
 * Converts ThirdWeb wallet to Ethers v5 Signer
 * Properly extends ethers.Signer class
 */
export async function getEthersV5Signer(wallet: any, chain: any) {
  // Dynamic import to avoid hydration issues
  const { ethers } = await import('ethers-v5');
  
  const account = wallet.getAccount();
  if (!account) {
    throw new Error('No account connected');
  }

  const rpcUrl = chain.rpc;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
    chainId: chain.id,
    name: chain.name || 'Base',
  });

  // Create a proper Signer class
  class ThirdWebSigner extends ethers.Signer {
    readonly address: string;
    readonly provider: ethers.providers.Provider;
    private wallet: any;

    constructor(address: string, provider: ethers.providers.Provider, wallet: any) {
      super();
      this.address = address;
      this.provider = provider;
      this.wallet = wallet;
    }

    async getAddress(): Promise<string> {
      return this.address;
    }

    async signMessage(message: string | ethers.utils.Bytes): Promise<string> {
      const messageString = typeof message === 'string' 
        ? message 
        : ethers.utils.toUtf8String(message);
      
      try {
        const signature = await this.wallet.signMessage({ message: messageString });
        return signature;
      } catch (error) {
        console.error('❌ signMessage error:', error);
        throw error;
      }
    }

    async signTransaction(transaction: ethers.providers.TransactionRequest): Promise<string> {
      throw new Error('signTransaction not implemented - use sendTransaction instead');
    }

    connect(provider: ethers.providers.Provider): ethers.Signer {
      return new ThirdWebSigner(this.address, provider, this.wallet);
    }
  }

  return new ThirdWebSigner(account.address, provider, wallet);
}
