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

