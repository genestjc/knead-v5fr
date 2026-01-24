// lib/ethers-signer-adapter.ts
"use client";

import { signMessage as thirdwebSignMessage } from "thirdweb/wallets";

/**
 * Converts ThirdWeb wallet to Ethers v5 Signer
 * Properly extends ethers.Signer with defineReadOnly (Towns SDK approved)
 */
export async function getEthersV5Signer(wallet: any, chain: any, client: any) {
  const { ethers } = await import("ethers-v5");
  
  const account = wallet.getAccount();
  if (!account) throw new Error("No account connected");

  const rpcUrl = chain.rpc;
  
  // Create provider
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
    chainId: chain.id,
    name: chain.name || 'Base',
  });

  /**
   * Custom Signer class for ThirdWeb wallets
   * Uses ethers.utils.defineReadOnly for proper property definition
   */
  class ThirdWebEthersSigner extends ethers.Signer {
    private account: any;

    constructor(account: any, provider: ethers.providers.Provider) {
      super();
      this.account = account;
      
      // Use defineReadOnly to set provider (required by ethers)
      ethers.utils.defineReadOnly(this, "provider", provider);
    }

    async getAddress(): Promise<string> {
      return this.account.address;
    }

    async signMessage(message: string | ethers.utils.Bytes): Promise<string> {
      // Convert message to string if needed
      let messageString: string;
      if (typeof message === 'string') {
        messageString = message;
      } else if (message instanceof Uint8Array) {
        messageString = ethers.utils.hexlify(message);
      } else {
        messageString = ethers.utils.toUtf8String(message);
      }
      
      console.log('🔐 Signing message with ThirdWeb');
      
      try {
        const signature = await thirdwebSignMessage({
          account: this.account,
          message: messageString,
        });
        
        console.log('✅ Signature received');
        return signature.startsWith('0x') ? signature : `0x${signature}`;
      } catch (error: any) {
        console.error('❌ Signing failed:', error);
        throw new Error(`Signing failed: ${error.message || 'Unknown error'}`);
      }
    }

    async signTransaction(transaction: ethers.providers.TransactionRequest): Promise<string> {
      throw new Error("signTransaction not supported - use sendTransaction");
    }

    connect(provider: ethers.providers.Provider): ethers.Signer {
      return new ThirdWebEthersSigner(this.account, provider);
    }

    // Optional: implement sendTransaction if needed
    async sendTransaction(transaction: ethers.providers.TransactionRequest): Promise<ethers.providers.TransactionResponse> {
      throw new Error("sendTransaction not implemented");
    }
  }

  const signer = new ThirdWebEthersSigner(account, provider);
  
  console.log('✅ Created ThirdWeb ethers v5 signer');
  console.log('   Address:', account.address);
  console.log('   Type:', signer.constructor.name);
  console.log('   Has provider:', !!signer.provider);
  console.log('   Has signMessage:', typeof signer.signMessage === 'function');
  console.log('   Has getAddress:', typeof signer.getAddress === 'function');
  
  // Test it
  const testAddress = await signer.getAddress();
  console.log('   Test getAddress():', testAddress);
  
  return signer;
}
