import { createThirdwebClient } from "thirdweb";
import { base } from "thirdweb/chains";
import { logger } from "./lib/logger";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
const alchemyRpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL;

// ✅ Validation in development
if (process.env.NODE_ENV !== 'production') {
  if (!clientId) {
    logger.warn("⚠️ WARNING: NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set!");
    logger.warn("ThirdWeb functionality may be limited. Check your .env file.");
  } else {
    logger.log("✅ ThirdWeb client ID configured correctly");
  }
  
  if (!alchemyRpcUrl) {
    logger.warn("⚠️ WARNING: NEXT_PUBLIC_BASE_RPC_URL is not set!");
    logger.warn("Will fall back to public RPC which may have CORS issues.");
  } else {
    logger.log("✅ Alchemy RPC URL configured:", alchemyRpcUrl.substring(0, 50) + "...");
  }

  if (typeof window === 'undefined' && !process.env.THIRDWEB_SECRET_KEY) {
    logger.warn("⚠️ WARNING: THIRDWEB_SECRET_KEY is not set!");
    logger.warn("Server-side operations (gas sponsorship, server wallet) will not work.");
  } else if (typeof window === 'undefined' && process.env.THIRDWEB_SECRET_KEY) {
    logger.log("✅ ThirdWeb secret key configured (server-side only)");
  }
}

export const client = createThirdwebClient({
  clientId:
    clientId ||
    (() => {
      throw new Error("NEXT_PUBLIC_THIRDWEB_CLIENT_ID is required");
    })(),
  ...(typeof window === "undefined" && process.env.THIRDWEB_SECRET_KEY
    ? { secretKey: process.env.THIRDWEB_SECRET_KEY }
    : {}),
});

// ✅ MULTI-RPC CONFIGURATION with automatic fallback
const RPC_ENDPOINTS = [
  alchemyRpcUrl,                                    // 1. Alchemy (your dedicated endpoint)
  `https://${base.id}.rpc.thirdweb.com/${clientId}`, // 2. Thirdweb RPC (included with client)
  'https://mainnet.base.org',                       // 3. Public Base RPC (last resort)
].filter(Boolean); // Remove any undefined values

logger.log(`📡 Configured ${RPC_ENDPOINTS.length} RPC endpoints for load balancing`);

// ✅ Round-robin index for load balancing (browser only)
let currentRpcIndex = 0;

/**
 * Get next RPC endpoint using round-robin strategy
 * Distributes load across all available RPCs
 */
function getNextRpcEndpoint(): string {
  if (typeof window === 'undefined') {
    // Server-side: always use Alchemy (most reliable)
    return RPC_ENDPOINTS[0];
  }
  
  // Client-side: rotate through all endpoints
  const endpoint = RPC_ENDPOINTS[currentRpcIndex];
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  return endpoint;
}

/**
 * Get all RPC endpoints for fallback configuration
 */
export function getAllRpcEndpoints(): string[] {
  return RPC_ENDPOINTS;
}

// ✅ Base chain with multi-RPC support
export const activeChain = {
  ...base,
  rpc: getNextRpcEndpoint(), // Primary RPC (rotates)
};

// ✅ Export RPC configuration for Towns SDK
export const TOWNS_RPC_CONFIG = {
  // Primary endpoint
  rpc: RPC_ENDPOINTS[0], // Alchemy first
  
  // Fallback endpoints
  fallbackRpcs: RPC_ENDPOINTS.slice(1), // Thirdweb + Public
  
  // All endpoints for manual fallback
  allEndpoints: RPC_ENDPOINTS,
};

logger.log(`ThirdWeb client initialized (${typeof window === 'undefined' ? 'server' : 'client'} side)`);
logger.log(`🔄 Load balancing across ${RPC_ENDPOINTS.length} RPC providers`);

export const KNEAD_MEMBERSHIP_CONTRACT = {
  address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85",
  name: "Knead Membership",
  type: "erc1155" as const,
  tokenIds: {
    freemium: 0,
    premium: 1,
  },
};
