// lib/ethers-signer-adapter.ts
"use client";

import type { Account } from "thirdweb/wallets";

/**
 * Converts ThirdWeb wallet to Ethers v5 Signer
 * Implements sendTransaction for Towns SDK compatibility
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
   * Fully implements Ethers v5 Signer interface
   */
  class ThirdWebEthersSigner extends ethers.Signer {
    private wallet: any;
    private client: any;
    private chain: any;

    constructor(wallet: any, provider: ethers.providers.Provider, client: any, chain: any) {
      super();
      this.wallet = wallet;
      this.client = client;
      this.chain = chain;
      
      ethers.utils.defineReadOnly(this, "provider", provider);
    }

    private getAccount(): Account {
      const account = this.wallet.getAccount();
      if (!account) throw new Error("No account connected");
      return account;
    }

    async getAddress(): Promise<string> {
      const account = this.getAccount();
      console.log('🔍 getAddress() called:', account.address);
      return account.address;
    }

    async signMessage(message: string | ethers.utils.Bytes): Promise<string> {
      const account = this.getAccount();
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔐 SIGNING MESSAGE');
      console.log('   Account address:', account.address);
      console.log('   Message type:', typeof message);
      console.log('   Message instanceof Uint8Array:', message instanceof Uint8Array);
      
      try {
        let signature: string;
        
        // Handle different message types
        if (typeof message === 'string') {
          console.log('   Signing as string, length:', message.length);
          console.log('   Message preview:', message.substring(0, 100) + '...');
          signature = await account.signMessage({ message });
        } else if (message instanceof Uint8Array) {
          // ✅ Sign bytes directly using ThirdWeb v5 raw format
          console.log('   Signing as RAW BYTES, length:', message.length);
          console.log('   Bytes preview:', ethers.utils.hexlify(message).substring(0, 100) + '...');
          signature = await account.signMessage({ 
            message: { raw: message }  // ← FIX: Sign raw bytes, not hex string
          });
        } else {
          // Fallback: convert to string
          const messageString = ethers.utils.toUtf8String(message);
          console.log('   Signing as UTF8 string:', messageString);
          signature = await account.signMessage({ message: messageString });
        }
        
        console.log('   ✅ Signature created:', signature.substring(0, 20) + '...');
        
        // Verify the signature (for debugging)
        try {
          const messageForVerify = typeof message === 'string' 
            ? message 
            : message instanceof Uint8Array 
              ? message 
              : ethers.utils.toUtf8String(message);
          
          const recoveredAddress = ethers.utils.verifyMessage(messageForVerify, signature);
          console.log('   Recovered address:', recoveredAddress);
          console.log('   Expected address:', account.address);
          console.log('   Match:', recoveredAddress.toLowerCase() === account.address.toLowerCase());
        } catch (verifyError) {
          console.log('   ⚠️ Could not verify signature locally (may be raw bytes - this is OK)');
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        return signature.startsWith('0x') ? signature : `0x${signature}`;
        
      } catch (error: any) {
        console.error('❌ Signing failed:', error);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        throw new Error(`Signing failed: ${error.message || 'Unknown error'}`);
      }
    }

    async signTransaction(transaction: ethers.providers.TransactionRequest): Promise<string> {
      throw new Error("signTransaction not supported - use sendTransaction instead");
    }

    connect(provider: ethers.providers.Provider): ethers.Signer {
      return new ThirdWebEthersSigner(this.wallet, provider, this.client, this.chain);
    }

    async sendTransaction(transaction: ethers.providers.TransactionRequest): Promise<ethers.providers.TransactionResponse> {
      console.log('📤 sendTransaction called');
      console.log('   Transaction:', transaction);
      
      const account = this.getAccount();
      console.log('📤 Sending from account:', account.address);
      
      try {
        const { sendTransaction: thirdwebSendTransaction, prepareTransaction } = await import('thirdweb');
        
        const preparedTx = prepareTransaction({
          to: transaction.to as string,
          value: transaction.value ? BigInt(transaction.value.toString()) : undefined,
          data: transaction.data ? transaction.data.toString() : undefined,
          gas: transaction.gasLimit ? BigInt(transaction.gasLimit.toString()) : undefined,
          chain: this.chain,
          client: this.client,
        });

        console.log('🔧 Sending via ThirdWeb account...');
        
        const result = await thirdwebSendTransaction({
          transaction: preparedTx,
          account: account,
        });

        console.log('✅ Transaction sent:', result.transactionHash);

        const txResponse: ethers.providers.TransactionResponse = {
          hash: result.transactionHash,
          from: await this.getAddress(),
          to: transaction.to as string,
          nonce: 0,
          gasLimit: ethers.BigNumber.from(0),
          data: transaction.data?.toString() || '0x',
          value: ethers.BigNumber.from(transaction.value || 0),
          chainId: this.chain.id,
          confirmations: 0,
          wait: async (confirmations?: number) => {
            console.log(`⏳ Waiting for ${confirmations || 1} confirmations...`);
            
            let receipt;
            let attempts = 0;
            const maxAttempts = 60;
            
            while (!receipt && attempts < maxAttempts) {
              try {
                receipt = await this.provider!.getTransactionReceipt(result.transactionHash);
                if (receipt) break;
              } catch (e) {
                // Transaction not yet mined
              }
              await new Promise(resolve => setTimeout(resolve, 1000));
              attempts++;
            }
            
            if (!receipt) {
              throw new Error('Transaction receipt not found after 60 seconds');
            }
            
            console.log('✅ Transaction confirmed');
            return receipt;
          },
        };

        return txResponse;

      } catch (error: any) {
        console.error('❌ sendTransaction failed:', error);
        throw new Error(`Failed to send transaction: ${error.message || 'Unknown error'}`);
      }
    }
  }

  const signer = new ThirdWebEthersSigner(wallet, provider, client, chain);
  
  console.log('✅ Created ThirdWeb ethers v5 signer');
  console.log('   Address:', account.address);
  console.log('   Has provider:', !!signer.provider);
  console.log('   Has signMessage:', typeof signer.signMessage === 'function');
  console.log('   Has sendTransaction:', typeof signer.sendTransaction === 'function');
  
  const testAddress = await signer.getAddress();
  console.log('   Test getAddress():', testAddress);
  
  return signer;
}
