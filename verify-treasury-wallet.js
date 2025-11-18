// Verification script to show Treasury wallet address
// Run with: node verify-treasury-wallet.js
//
// This wallet is managed via ThirdWeb Secret Key
// No private key verification needed

const TREASURY_WALLET_ADDRESS = "0xb66b525552418a8Bf3094bCDbb5c3118F012d941";

console.log("\n✅ Treasury/Server Wallet Address:", TREASURY_WALLET_ADDRESS);
console.log("\n📍 Next steps:");
console.log("1. Fund this address with $TOWNS tokens on Base network");
console.log("2. Make sure this address has some ETH for gas fees");
console.log("3. Ensure THIRDWEB_SECRET_KEY is set in environment variables");
console.log("\n💡 This wallet is managed via ThirdWeb Secret Key");
console.log("   No private key storage required in environment variables\n");