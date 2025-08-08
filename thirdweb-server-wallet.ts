import { createThirdwebClient } from "thirdweb";
import { privateKeyAccount } from "thirdweb/wallets";
import { getBalance } from "thirdweb/extensions/evm";
import { base } from "thirdweb/chains";

// Check environment variables first
if (!process.env.THIRDWEB_SECRET_KEY) {
  console.error("❌ CRITICAL: THIRDWEB_SECRET_KEY is not set!");
}

if (!process.env.THIRDWEB_PRIVATE_KEY) {
  console.error("❌ CRITICAL: THIRDWEB_PRIVATE_KEY is not set!");
}

// Create client
export const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
});

// Initialize server wallet - declare at module level
export const serverWallet = privateKeyAccount({
  client,
  privateKey: process.env.THIRDWEB_PRIVATE_KEY!, // NEVER expose to frontend
});

// Immediately-invoked function expression for initialization and checks
(async () => {
  try {
    console.log("✅ Server wallet initialized with address:", serverWallet.address);
    
    // Check server wallet balance (this will run in development for debugging)
    if (process.env.NODE_ENV !== 'production') {
      try {
        const balance = await getBalance({
          client,
          account: serverWallet,
          chain: base,
        });
        
        console.log(`💰 Server wallet balance: ${balance.displayValue} ${balance.symbol}`);
        
        if (balance.value < BigInt(5000000000000000)) { // 0.005 ETH
          console.warn("⚠️ WARNING: Server wallet has low balance for gas fees");
        }
      } catch (balanceErr) {
        console.error("❌ Failed to check server wallet balance:", balanceErr);
      }
    }
  } catch (error) {
    console.error("❌ Failed to properly initialize server wallet:", error);
    // In production, you might want to log this but not crash the server
    // since exports have already happened
  }
})();
