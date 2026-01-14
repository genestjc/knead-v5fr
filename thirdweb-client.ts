import { createThirdwebClient, getNativeBalance } from "thirdweb"; // Restored getNativeBalance
import { base } from "thirdweb/chains";
import { balanceOf } from "thirdweb/extensions/erc1155"; // Restored balanceOf
import { getContract } from "thirdweb"; // Restored getContract
import { logger } from "@/lib/logger";

// Client ID from environment - REQUIRED, no fallback for security
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

// Validate client ID exists
if (!clientId) {
  const errorMsg = "NEXT_PUBLIC_THIRDWEB_CLIENT_ID is required but not set in environment variables";
  if (process.env.NODE_ENV !== 'production') {
    console.error("❌ " + errorMsg);
  }
  throw new Error(errorMsg);
}

// Create client - no fallback, fail fast if missing
export const client = createThirdwebClient({ 
  clientId
});

// --- THIS IS THE ONLY INTENDED ADDITION ---
// Export the active chain so other components can use it consistently.
export const activeChain = base;

// Log initialization status (only in development)
logger.debug(`ThirdWeb client initialized (${typeof window === 'undefined' ? 'server' : 'client'} side)`);

// Your existing contract definitions are unchanged.
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
    },
  },
];
