// Verification script to check current Treasury wallet address
// Run with: node verify-treasury-wallet.js

const { privateKeyToAccount } = require("thirdweb/wallets");
const { createThirdwebClient } = require("thirdweb");

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const privateKey = process.env.THIRDWEB_PRIVATE_KEY;
const secretKey = process.env.THIRDWEB_SECRET_KEY;

if (!privateKey || !secretKey) {
  console.error("❌ Missing THIRDWEB_PRIVATE_KEY or THIRDWEB_SECRET_KEY");
  console.error("Make sure you have a .env.local file with these variables set");
  process.exit(1);
}

try {
  const client = createThirdwebClient({ secretKey });
  const account = privateKeyToAccount({ client, privateKey });

  console.log("\n✅ Current Treasury Wallet Address:", account.address);
  console.log("\n📍 Next steps:");
  console.log("1. Fund this address with $TOWNS tokens on Base network");
  console.log("2. Make sure this address has some ETH for gas fees");
  console.log("\n🆚 Compare with new Server Wallet: 0xb66b525552418a8Bf3094bCDbb5c3118F012d941");
  console.log("   - If addresses match: You already updated the key ✅");
  console.log("   - If different: Decide which wallet to use as Treasury\n");
} catch (error) {
  console.error("❌ Error verifying wallet:", error.message);
  process.exit(1);
}