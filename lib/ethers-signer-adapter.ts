// lib/ethers-signer-adapter.ts
"use client";

import { signMessage as thirdwebSignMessage } from "thirdweb/wallets";

export async function getEthersV5Signer(wallet: any, chain: any, client: any) {
  const { ethers } = await import("ethers-v5");
  
  const account = wallet.getAccount();
  if (!account) throw new Error("No account connected");

  const rpcUrl = chain.rpc;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
    chainId: chain.id,
    name: chain.name || "Base",
  });

  class ThirdWebSigner extends ethers.Signer {
    readonly address: string;
    readonly provider: ethers.providers.Provider;
    readonly _isSigner: boolean = true; // ✅ Required by ethers v5
    private account: any;

    constructor(address: string, provider: ethers.providers.Provider, account: any) {
      super();
      
      // ✅ Define address and provider as non-enumerable properties
      Object.defineProperty(this, 'address', {
        enumerable: true,
        value: address,
        writable: false,
      });
      
      Object.defineProperty(this, 'provider', {
        enumerable: true,
        value: provider,
        writable: false,
      });
      
      Object.defineProperty(this, '_isSigner', {
        enumerable: false,
        value: true,
        writable: false,
      });
      
      this.account = account;
    }

    async getAddress(): Promise<string> {
      return Promise.resolve(this.address);
    }

    async signMessage(message: string | ethers.utils.Bytes): Promise<string> {
      let messageString: string;
      if (typeof message === "string") {
        messageString = message;
      } else if (message instanceof Uint8Array) {
        messageString = ethers.utils.hexlify(message);
      } else {
        messageString = ethers.utils.toUtf8String(message);
      }

      console.log('🔐 Signing message...');

      try {
        const signature = await thirdwebSignMessage({
          account: this.account,
          message: messageString,
        });

        console.log('✅ Signature received');
        return signature.startsWith("0x") ? signature : `0x${signature}`;
      } catch (error: any) {
        console.error('❌ Signing failed:', error);
        throw new Error(`Signing failed: ${error.message || 'Unknown error'}`);
      }
    }

    async signTransaction(transaction: ethers.providers.TransactionRequest): Promise<string> {
      throw new Error("signTransaction not supported - use sendTransaction");
    }

    connect(provider: ethers.providers.Provider): ethers.Signer {
      return new ThirdWebSigner(this.address, provider, this.account);
    }

    // ✅ Add sendTransaction for completeness
    async sendTransaction(transaction: ethers.providers.TransactionRequest): Promise<ethers.providers.TransactionResponse> {
      throw new Error("sendTransaction not implemented");
    }
  }

  const signer = new ThirdWebSigner(account.address, provider, account);
  
  // ✅ Verify the signer is valid
  console.log('✅ Signer created');
  console.log('   Address:', signer.address);
  console.log('   _isSigner:', (signer as any)._isSigner);
  console.log('   Has getAddress:', typeof signer.getAddress === 'function');
  console.log('   Has signMessage:', typeof signer.signMessage === 'function');
  
  // ✅ Test getAddress immediately
  const testAddress = await signer.getAddress();
  console.log('   Test getAddress():', testAddress);
  
  return signer;
}
