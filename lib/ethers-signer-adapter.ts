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
    private wallet: any;  // Store wallet instead of account
    private client: any;
    private chain: any;

    constructor(wallet: any, provider: ethers.providers.Provider, client: any, chain: any) {
      super();
      this.wallet = wallet;  // Store wallet, not account
      this.client = client;
      this.chain = chain;
      
      // Use defineReadOnly to set provider (required by ethers)
      ethers.utils.defineReadOnly(this, "provider", provider);
    }

    // Always get fresh account
    private getAccount(): Account {
      const account = this.wallet.getAccount();
      if (!account) throw new Error("No account connected");
      return account;
    }

    async getAddress(): Promise<string> {
      const account = this.getAccount();  // Fresh account every time
      console.log('🔍 getAddress() called:', account.address);
      return account.address;
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
      
      const account = this.getAccount();  // Fresh account every time
      console.log('🔐 Signing message with account:', account.address);
      console.log('🔐 Message to sign:', messageString);
      
      try {
        // Use the account's signMessage method directly (ThirdWeb v5)
        if (typeof account.signMessage === 'function') {
          const signature = await account.signMessage({ message: messageString });
          console.log('✅ Signature received from account:', account.address);
          console.log('✅ Signature:', signature.substring(0, 20) + '...');
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
      return new ThirdWebEthersSigner(this.wallet, provider, this.client, this.chain);
    }

    // ✅ Implement sendTransaction for Towns SDK
    async sendTransaction(transaction: ethers.providers.TransactionRequest): Promise<ethers.providers.TransactionResponse> {
      console.log('📤 sendTransaction called');
      console.log('   Transaction:', transaction);
      
      const account = this.getAccount();  // Fresh account every time
      console.log('📤 Sending from account:', account.address);
      
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
          account: account,
        });

        console.log('✅ Transaction sent:', result.transactionHash);

        // Convert to ethers TransactionResponse format
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
  
  // Test it
  const testAddress = await signer.getAddress();
  console.log('   Test getAddress():', testAddress);
  
  return signer;
}
