import { createThirdwebClient } from "thirdweb";
import { base } from "thirdweb/chains";
import { logger } from "./lib/logger";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
const baseRpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL;

// ✅ Validation in development
if (process.env.NODE_ENV !== 'production') {
  if (!clientId) {
    logger.warn("⚠️ WARNING: NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set!");
    logger.warn("ThirdWeb functionality may be limited. Check your .env file.");
  } else {
    logger.log("✅ ThirdWeb client ID configured correctly");
  }
  
  if (!baseRpcUrl) {
    logger.warn("⚠️ WARNING: NEXT_PUBLIC_BASE_RPC_URL is not set!");
    logger.warn("Will fall back to public RPC which may have CORS issues.");
  } else {
    logger.log("✅ Base RPC URL configured:", baseRpcUrl.substring(0, 50) + "...");
  }

  // ✅ Check for secret key on server-side
  if (typeof window === 'undefined' && !process.env.THIRDWEB_SECRET_KEY) {
    logger.warn("⚠️ WARNING: THIRDWEB_SECRET_KEY is not set!");
    logger.warn("Server-side operations (gas sponsorship, server wallet) will not work.");
  } else if (typeof window === 'undefined' && process.env.THIRDWEB_SECRET_KEY) {
    logger.log("✅ ThirdWeb secret key configured (server-side only)");
  }
}

// ✅ Create ThirdWeb client with proper error handling
// Secret key is ONLY included server-side (never exposed to browser)
export const client = createThirdwebClient({
  clientId:
    clientId ||
    (() => {
      throw new Error("NEXT_PUBLIC_THIRDWEB_CLIENT_ID is required");
    })(),
  // ✅ CRITICAL: Only add secretKey on server-side (typeof window === "undefined")
  // This prevents exposing the secret key to the browser bundle
  ...(typeof window === "undefined" && process.env.THIRDWEB_SECRET_KEY
    ? { secretKey: process.env.THIRDWEB_SECRET_KEY }
    : {}),
});

// ✅ Throw error if RPC URL is missing (better than silent fallback)
if (!baseRpcUrl) {
  throw new Error('NEXT_PUBLIC_BASE_RPC_URL is required to avoid CORS issues');
}

// ✅ Base chain for Base network operations (NFTs, tokens, etc.)
export const activeChain = {
  ...base,
  rpc: baseRpcUrl,
};

logger.log(`ThirdWeb client initialized (${typeof window === 'undefined' ? 'server' : 'client'} side)`);

export const KNEAD_MEMBERSHIP_CONTRACT = {
  address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85",
  name: "Knead Membership",
  type: "erc1155" as const,
  tokenIds: {
    freemium: 0,
    premium: 1,
  },
};
