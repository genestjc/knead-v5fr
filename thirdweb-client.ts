import { createThirdwebClient, getNativeBalance } from "thirdweb";
import { base } from "thirdweb/chains";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { getContract } from "thirdweb";
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

// ✅ Use Alchemy RPC for Base Chain (Chain ID 8453)
// Used for: NFT balance checks, contract interactions, blockchain queries
export const activeChain = {
  ...base,
  rpc: baseRpcUrl, // Your Alchemy RPC for Base Chain
};

// ✅ CORRECT: Use Towns Chain RPC (Chain ID 550)
// Used for: Towns Protocol chat, spaces, channels, messages
export const townsChainRpc = 'https://mainnet.rpc.towns.com';

logger.log(`ThirdWeb client initialized (${typeof window === 'undefined' ? 'server' : 'client'} side)`);
logger.log(`Base Chain: Alchemy RPC | Towns Chain: ${townsChainRpc}`);

export const KNEAD_MEMBERSHIP_CONTRACT = {
  address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85",
  name: "Knead Membership",
  type: "erc1155" as const,
  tokenIds: {
    freemium: 0,
    premium: 1,
  },
};
