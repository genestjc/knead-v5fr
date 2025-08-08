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

// Create client with logging
export const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
});

// Initialize server wallet with error handling
try {
  export const serverWallet = privateKeyAccount({
    client,
    privateKey: process.env.THIRDWEB_PRIVATE_KEY!, // NEVER expose to frontend
  });
  
  console.log("✅ Server wallet initialized with address:", serverWallet.address);
  
  // Check server wallet balance (this will run in development for debugging)
  if (process.env.NODE_ENV !== 'production') {
    getBalance({
      client,
      account: serverWallet,
      chain: base,
    }).then(balance => {
      console.log(`💰 Server wallet balance: ${balance.displayValue} ${balance.symbol}`);
      
      if (balance.value < BigInt(5000000000000000)) { // 0.005 ETH
        console.warn("⚠️ WARNING: Server wallet has low balance for gas fees");
      }
    }).catch(err => {
      console.error("❌ Failed to check server wallet balance:", err);
    });
  }
} catch (error) {
  console.error("❌ Failed to initialize server wallet:", error);
  // In production, you might want to prevent the server from starting
  if (process.env.NODE_ENV === 'production') {
    throw new Error("Critical error initializing server wallet");
  }
}
