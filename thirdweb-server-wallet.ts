import { createThirdwebClient, Engine, getBalance as getNativeBalance } from "thirdweb";
import { getContract } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";

// Validate required environment variables
if (!process.env.THIRDWEB_SECRET_KEY) {
  throw new Error("❌ CRITICAL: THIRDWEB_SECRET_KEY must be set!");
}
if (!process.env.ENGINE_SERVER_WALLET_ADDRESS) {
  throw new Error("❌ CRITICAL: ENGINE_SERVER_WALLET_ADDRESS must be set!");
}
if (!process.env.ENGINE_VAULT_ACCESS_TOKEN) {
  throw new Error("❌ CRITICAL: ENGINE_VAULT_ACCESS_TOKEN must be set!");
}

// Create ThirdWeb client with Secret Key
export const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY,
});

// Create Engine Server Wallet (no private key needed!)
export const serverWallet = Engine.serverWallet({
  client,
  address: process.env.ENGINE_SERVER_WALLET_ADDRESS,
  vaultAccessToken: process.env.ENGINE_VAULT_ACCESS_TOKEN,
});

// Export wallet address as constant
export const SERVER_WALLET_ADDRESS = process.env.ENGINE_SERVER_WALLET_ADDRESS;

// Use contract address from env var
const ERC1155_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;

// Initialize and check balances
(async () => {
  try {
    console.log("✅ Server wallet initialized with address:", SERVER_WALLET_ADDRESS);

    if (process.env.NODE_ENV !== "production") {
      // 1. Check native token balance (for gas)
      const nativeBalance = await getNativeBalance({
        client,
        address: SERVER_WALLET_ADDRESS,
        chain: base,
      });
      console.log(
        `💰 Server wallet native balance: ${nativeBalance.displayValue} ${nativeBalance.symbol}`,
      );
      if (nativeBalance.value < 5_000_000_000_000_000n) {
        console.warn("⚠️ WARNING: Server wallet has low balance for gas fees");
      }

      // 2. Check ERC1155 token balances
      const contract = getContract({
        client,
        address: ERC1155_CONTRACT_ADDRESS,
        chain: base,
      });

      // Check both FREEMIUM (0) and PAID (1)
      const tokenIds = [0n, 1n];
      for (const tokenId of tokenIds) {
        const erc1155Balance = await balanceOf({
          contract,
          owner: SERVER_WALLET_ADDRESS,
          tokenId,
        });
        console.log(
          `🪙 ERC1155 Token ID ${tokenId} balance: ${erc1155Balance.value}`,
        );
      }
    }
  } catch (error) {
    console.error("❌ Failed to properly initialize server wallet:", error);
  }
})();
