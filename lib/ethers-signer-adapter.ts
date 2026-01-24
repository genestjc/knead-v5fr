// lib/ethers-signer-adapter.ts
'use client';

/**
 * Converts ThirdWeb wallet to Ethers v5 Signer
 * 
 * Properly extends ethers.Signer class with correct signature formatting
 * to bridge thirdweb wallets with ethers v5 for Towns SDK compatibility.
 * 
 * @see https://docs.ethers.org/v5/api/signer/
 * @see https://portal.thirdweb.com/references/wallets/latest/signMessage
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

  /**
   * Custom Signer that wraps a ThirdWeb wallet
   * Implements the ethers v5 Signer interface
   */
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
      // Convert message to appropriate format for ThirdWeb
      let messageString: string;
      
      if (typeof message === 'string') {
        messageString = message;
      } else if (message instanceof Uint8Array) {
        // Convert Uint8Array to hex string for ThirdWeb
        messageString = ethers.utils.hexlify(message);
      } else {
        messageString = ethers.utils.toUtf8String(message);
      }
      
      console.log('🔐 Signing message with ThirdWeb wallet...');
      
      try {
        // Use ThirdWeb's signMessage method
        const signature = await this.wallet.signMessage({ message: messageString });
        
        console.log('✅ Signature received from wallet');
        
        // Validate signature format
        if (!signature || typeof signature !== 'string') {
          throw new Error('Invalid signature format from wallet');
        }
        
        // Ensure signature has 0x prefix (required by ethers v5)
        const formattedSignature = signature.startsWith('0x') ? signature : `0x${signature}`;
        
        return formattedSignature;
      } catch (error: any) {
        console.error('❌ Failed to sign message:', error);
        throw new Error(`Signing failed: ${error.message || 'Unknown error'}`);
      }
    }

    async signTransaction(transaction: ethers.providers.TransactionRequest): Promise<string> {
      // Towns SDK doesn't use this, but it's required by the Signer interface
      throw new Error('signTransaction not supported - use sendTransaction instead');
    }

    connect(provider: ethers.providers.Provider): ethers.Signer {
      return new ThirdWebSigner(this.address, provider, this.wallet);
    }
  }

  const signer = new ThirdWebSigner(account.address, provider, wallet);
  
  console.log('✅ Created ethers v5 signer for address:', account.address);
  
  return signer;
}
