import { createThirdwebClient, getNativeBalance } from "thirdweb";
import { base } from "thirdweb/chains";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { getContract } from "thirdweb";

// Client ID from environment with diagnostic checks
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

// Print diagnostic info on initialization, but only in non-production
if (process.env.NODE_ENV !== 'production') {
  if (!clientId) {
    console.warn("⚠️ WARNING: NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set!");
    console.warn("ThirdWeb functionality may be limited. Check your .env file.");
  } else {
    console.log("✅ ThirdWeb client ID configured correctly");
  }
}

// Create client with proper error handling
export const client = createThirdwebClient({ 
  clientId: clientId || "44984f2bc038cebc6138d4ceb602c35d" // Fallback for development
});

// Log initialization status
console.log(`ThirdWeb client initialized (${typeof window === 'undefined' ? 'server' : 'client'} side)`);

// New Knead Membership Contract (Soulbound ERC1155)
export const KNEAD_MEMBERSHIP_CONTRACT = {
  address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85",
  name: "Knead Membership",
  type: "erc1155",
  tokenIds: {
    freemium: 0,
    premium: 1,
  },
};

// Legacy NFT Collections that also provide access to all content
export const LEGACY_MEMBERSHIP_CONTRACTS = [
  {
    address: "0x0e70AB324E8761E97F131Eecc4Dd63dFDE33cB72",
    name: "Breadwinner's Club Membership",
    type: "erc721",
  },
  {
    address: "0xa4b1aF8cffEE71D71721cB69596C9A31ac449F13",
    name: "2025 Annual + Shift Meal Membership",
    type: "erc1155",
    tokenIds: {
      annual: 1,
      shift: 2,
}
