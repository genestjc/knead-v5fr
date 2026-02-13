import type { Account } from "thirdweb/wallets";
import type { ThirdwebClient } from "thirdweb";
import type { Chain } from "thirdweb/chains";
import { ethers5Adapter } from "thirdweb/adapters/ethers5";
import type { Signer } from "ethers"; // ethers v5 type

/**
 * Creates an ethers v5 Signer from ThirdWeb Account
 * 
 * ✅ Uses official ThirdWeb adapter (not custom implementation)
 * ✅ Produces signatures compatible with ethers.utils.verifyMessage()
 * ✅ Required for Towns Protocol SDK integration
 */
export async function createTownsSigner(
  account: Account,
  client: ThirdwebClient,
  chain: Chain,
): Promise<Signer> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 CREATING ETHERS V5 SIGNER');
  console.log('   Method: ThirdWeb Official Adapter');
  console.log('   Account:', account.address);
  console.log('   Chain:', chain.name, `(${chain.id})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // ✅ Use official ThirdWeb adapter for ethers v5
    const ethersSigner = await ethers5Adapter.signer.toEthers({
      client,
      chain,
      account,
    });

    console.log('✅ Signer created using official ThirdWeb adapter');
    console.log('   Type:', typeof ethersSigner);
    console.log('   Has signMessage:', typeof ethersSigner.signMessage === 'function');
    console.log('   Has getAddress:', typeof ethersSigner.getAddress === 'function');

    // Verify the signer works
    const signerAddress = await ethersSigner.getAddress();
    console.log('✅ Signer verification:');
    console.log('   Account address:', account.address);
    console.log('   Signer address:', signerAddress);
    console.log('   Match:', signerAddress.toLowerCase() === account.address.toLowerCase());

    if (signerAddress.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(
        `Signer address mismatch! Account: ${account.address}, Signer: ${signerAddress}`
      );
    }

    console.log('✅ Ethers v5 signer ready for Towns Protocol');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return ethersSigner;
  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ FAILED TO CREATE SIGNER');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    throw error;
  }
}
