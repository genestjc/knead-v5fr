import type { Account } from "thirdweb/wallets";
import type { ThirdwebClient } from "thirdweb";
import type { Chain } from "thirdweb/chains";
import { ethers } from "ethers"; // v5

/**
 * Custom ethers v5 Signer that wraps a ThirdWeb Account
 * and includes a proper JsonRpcProvider required by Towns SDK
 */
class ThirdWebEthersSigner extends ethers.Signer {
  readonly provider: ethers.providers.JsonRpcProvider;
  private account: Account;
  
  constructor(account: Account, provider: ethers.providers.JsonRpcProvider) {
    super();
    this.account = account;
    this.provider = provider;
  }
  
  async getAddress(): Promise<string> {
    return this.account.address;
  }
  
  async signMessage(message: string | ethers.utils.Bytes): Promise<string> {
    const messageString = typeof message === 'string' 
      ? message 
      : ethers.utils.toUtf8String(message);
    
    const signature = await this.account.signMessage({ message: messageString });
    return signature;
  }
  
  async signTransaction(transaction: ethers.providers.TransactionRequest): Promise<string> {
    throw new Error("signTransaction not implemented for ThirdWeb adapter");
  }
  
  connect(provider: ethers.providers.Provider): ethers.Signer {
    return new ThirdWebEthersSigner(
      this.account, 
      provider as ethers.providers.JsonRpcProvider
    );
  }
}

/**
 * Creates an ethers v5 Signer from ThirdWeb Account with proper provider
 * 
 * ✅ Creates complete ethers v5 Signer with JsonRpcProvider
 * ✅ Required by Towns SDK's riverConnection for authentication
 * ✅ Wraps ThirdWeb account's native signMessage() method
 * ✅ Includes verification steps for provider and signing
 */
export async function createTownsSigner(
  account: Account,
  client: ThirdwebClient,
  chain: Chain,
): Promise<ethers.Signer> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 CREATING ETHERS V5 SIGNER WITH PROVIDER');
  console.log('   Account:', account.address);
  console.log('   Chain:', chain.name, `(${chain.id})`);

  try {
    // Get RPC URL from chain
    const rpcUrl = typeof chain.rpc === 'string' 
      ? chain.rpc 
      : chain.rpc?.[0] || `https://${chain.id}.rpc.thirdweb.com`;

    console.log('   RPC:', rpcUrl.substring(0, 50) + '...');

    // Create JsonRpcProvider (required by Towns SDK)
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    // Test provider connection
    const network = await provider.getNetwork();
    console.log('✅ Provider connected:', network.name, `(${network.chainId})`);

    // Create custom signer with provider
    const signer = new ThirdWebEthersSigner(account, provider);

    // Verify signer
    const signerAddress = await signer.getAddress();
    console.log('✅ Signer verification:');
    console.log('   Account address:', account.address);
    console.log('   Signer address:', signerAddress);
    console.log('   Has provider:', !!signer.provider);
    console.log('   Provider connected:', !!signer.provider._network);

    if (signerAddress.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(
        `Signer address mismatch! Account: ${account.address}, Signer: ${signerAddress}`
      );
    }

    // Test sign capability
    try {
      const testMessage = "Towns SDK Signer Test";
      const testSig = await signer.signMessage(testMessage);
      console.log('✅ Signature test successful');
      console.log('   Message:', testMessage);
      console.log('   Signature:', testSig.substring(0, 20) + '...');
    } catch (sigError: any) {
      throw new Error(`Signature test failed: ${sigError.message}`);
    }

    console.log('✅ Ethers v5 signer ready for Towns Protocol');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return signer;
  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ FAILED TO CREATE SIGNER');
    console.error('   Error:', error.message);
    console.error('   Account:', account.address);
    console.error('   Chain:', chain.id);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    throw error;
  }
}
