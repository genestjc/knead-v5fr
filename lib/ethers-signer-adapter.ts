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
    private account: Account;
    private wallet: any;
    private client: any;
    private chain: any;

    constructor(account: Account, wallet: any, provider: ethers.providers.Provider, client: any, chain: any) {
      super();
      this.account = account;
      this.wallet = wallet;
      this.client = client;
      this.chain = chain;
      
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
      
      console.log('🔐 Signing message with account.signMessage()');
      
      try {
        // Use the account's signMessage method directly (ThirdWeb v5)
        if (typeof this.account.signMessage === 'function') {
          const signature = await this.account.signMessage({ message: messageString });
          console.log('✅ Signature received from account');
          return signature.startsWith('0x') ? signature : `0x${signature}`;
        }
        
        throw new Error('Account does not support signMessage');
      } catch (error: any) {
        console.error('❌ Signing failed:', error);
        throw new Error(`Signing failed: ${error.message || 'Unknown error'}`);
      }
    }

    async signTransaction(transaction: ethers.providers.TransactionRequest): Promise<string> {
      throw new Error("signTransaction not supported - use sendTransaction instead");
    }

    connect(provider: ethers.providers.Provider): ethers.Signer {
      return new ThirdWebEthersSigner(this.account, this.wallet, provider, this.client, this.chain);
    }

    // ✅ Implement sendTransaction for Towns SDK
    async sendTransaction(transaction: ethers.providers.TransactionRequest): Promise<ethers.providers.TransactionResponse> {
      console.log('📤 sendTransaction called');
      console.log('   Transaction:', transaction);
      
      try {
        // Import ThirdWeb SDK functions
        const { sendTransaction: thirdwebSendTransaction, prepareTransaction } = await import('thirdweb');
        
        // Prepare transaction for ThirdWeb
        const preparedTx = prepareTransaction({
          to: transaction.to as string,
          value: transaction.value ? BigInt(transaction.value.toString()) : undefined,
          data: transaction.data ? transaction.data.toString() : undefined,
          gas: transaction.gasLimit ? BigInt(transaction.gasLimit.toString()) : undefined,
          chain: this.chain,
          client: this.client,
        });

        console.log('🔧 Sending via ThirdWeb account...');
        
        // Send using ThirdWeb
        const result = await thirdwebSendTransaction({
          transaction: preparedTx,
          account: this.account,
        });

        console.log('✅ Transaction sent:', result.transactionHash);

        // Convert to ethers TransactionResponse format
        const txResponse: ethers.providers.TransactionResponse = {
          hash: result.transactionHash,
          from: await this.getAddress(),
          to: transaction.to as string,
          nonce: 0, // Will be filled by provider
          gasLimit: ethers.BigNumber.from(0),
          data: transaction.data?.toString() || '0x',
          value: ethers.BigNumber.from(transaction.value || 0),
          chainId: this.chain.id,
          confirmations: 0,
          wait: async (confirmations?: number) => {
            console.log(`⏳ Waiting for ${confirmations || 1} confirmations...`);
            
            // Wait for transaction receipt
            let receipt;
            let attempts = 0;
            const maxAttempts = 60; // 60 seconds timeout
            
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

  const signer = new ThirdWebEthersSigner(account, wallet, provider, client, chain);
  
  console.log('✅ Created ThirdWeb ethers v5 signer');
  console.log('   Address:', account.address);
  console.log('   Has provider:', !!signer.provider);
  console.log('   Has signMessage:', typeof signer.signMessage === 'function');
  console.log('   Has sendTransaction:', typeof signer.sendTransaction === 'function');
  
  // Test it
  const testAddress = await signer.getAddress();
  console.log('   Test getAddress():', testAddress);
  
  return signer;
}
