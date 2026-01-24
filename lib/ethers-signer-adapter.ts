// lib/ethers-signer-adapter.ts
"use client";

/**
 * Converts ThirdWeb wallet to Ethers v5 Signer
 * Uses ThirdWeb v5 SDK signing functions (confirmed by ThirdWeb)
 * 
 * @see https://portal.thirdweb.com/references/wallets/latest/signMessage
 */
export async function getEthersV5Signer(wallet: any, chain: any, client: any) {
  const { ethers } = await import("ethers-v5");
  const { signMessage: thirdwebSignMessage } = await import("thirdweb/wallets");

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
    private wallet: any;
    private client: any;

    constructor(
      address: string,
      provider: ethers.providers.Provider,
      wallet: any,
      client: any,
    ) {
      super();
      this.address = address;
      this.provider = provider;
      this.wallet = wallet;
      this.client = client;
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

      console.log('🔐 Signing message with ThirdWeb SDK...');

      try {
        // Use ThirdWeb's SDK function for signing (v5 method)
        const signature = await thirdwebSignMessage({
          account: this.wallet.getAccount()!,
          message: messageString,
        });

        console.log('✅ Signature received from ThirdWeb');

        // Ensure 0x prefix
        return signature.startsWith("0x") ? signature : `0x${signature}`;
      } catch (error: any) {
        console.error('❌ Signing failed:', error);
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
      return new ThirdWebSigner(
        this.address,
        provider,
        this.wallet,
        this.client,
      );
    }
  }

  const signer = new ThirdWebSigner(account.address, provider, wallet, client);
  console.log('✅ Created ethers v5 signer for:', account.address);
  
  return signer;
}
