// lib/ethers-signer-adapter.ts
"use client";

/**
 * Converts ThirdWeb wallet to Ethers v5 Signer
 * Uses account's direct signing method (ThirdWeb v5)
 */
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
    private account: any;

    constructor(
      address: string,
      provider: ethers.providers.Provider,
      account: any,
    ) {
      super();
      this.address = address;
      this.provider = provider;
      this.account = account;
    }

    async getAddress(): Promise<string> {
      return this.address;
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

      console.log('🔐 Signing message with account...');

      try {
        // Try account.signMessage if it exists
        if (typeof this.account.signMessage === 'function') {
          const signature = await this.account.signMessage({ message: messageString });
          console.log('✅ Signature from account.signMessage');
          return signature.startsWith("0x") ? signature : `0x${signature}`;
        }
        
        // Otherwise use the thirdweb SDK
        const { signMessage: sdkSignMessage } = await import("thirdweb/wallets");
        const signature = await sdkSignMessage({
          account: this.account,
          message: messageString,
        });
        
        console.log('✅ Signature from SDK signMessage');
        return signature.startsWith("0x") ? signature : `0x${signature}`;
      } catch (error: any) {
        console.error('❌ Signing failed:', error);
        console.error('Account object:', this.account);
        console.error('Account methods:', Object.keys(this.account || {}).filter(k => typeof (this.account as any)[k] === 'function'));
        throw new Error(`Signing failed: ${error.message || 'Unknown error'}`);
      }
    }

    async signTransaction(
      _: ethers.providers.TransactionRequest,
    ): Promise<string> {
      throw new Error(
        "signTransaction not supported - use sendTransaction instead",
      );
    }

    connect(provider: ethers.providers.Provider): ethers.Signer {
      return new ThirdWebSigner(this.address, provider, this.account);
    }
  }

  const signer = new ThirdWebSigner(account.address, provider, account);
  console.log('✅ Created ethers v5 signer for:', account.address);
  
  return signer;
}
