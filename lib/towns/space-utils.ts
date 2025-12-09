/**
 * Towns Protocol Space Utilities
 * 
 * Helper functions for Towns space creation and management
 * - Query network limits (max free supply)
 * - Error translation from Solidity reverts
 * - Validation helpers
 */

import { 
  createThirdwebClient,
  getContract,
  readContract,
} from "thirdweb";
import { base } from "thirdweb/chains";

// SpaceFactory contract address on Base
const SPACE_FACTORY_ADDRESS = "0x9978c826d93883701522d2ca645d5436e5654252";

// Minimal ABI for querying max free supply from the Architect contract
const ARCHITECT_ABI = [
  {
    inputs: [],
    name: "getMaxFreeAllocation",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Query the network's maximum free allocation limit
 * This is the Towns Protocol's on-chain limit for free memberships
 * 
 * @param clientId - ThirdWeb client ID
 * @returns Maximum free allocation as bigint
 */
export async function getMaxFreeAllocation(clientId: string): Promise<bigint> {
  try {
    const client = createThirdwebClient({ clientId });
    
    const contract = getContract({
      client,
      chain: base,
      address: SPACE_FACTORY_ADDRESS,
      abi: ARCHITECT_ABI,
    });

    const maxFreeAllocation = await readContract({
      contract,
      method: "function getMaxFreeAllocation() view returns (uint256)",
      params: [],
    });

    console.log(`✅ Network max free allocation: ${maxFreeAllocation}`);
    return maxFreeAllocation;
  } catch (error) {
    console.error('❌ Failed to query max free allocation:', error);
    // Fallback to 100 if query fails (Omega network default)
    console.log('⚠️  Using fallback value of 100');
    return 100n;
  }
}

/**
 * Validate free allocation against network limits
 * 
 * @param requestedAllocation - The free allocation being requested
 * @param maxAllocation - The network's maximum free allocation
 * @returns Validation result with error message if invalid
 */
export function validateFreeAllocation(
  requestedAllocation: bigint,
  maxAllocation: bigint
): { valid: boolean; error?: string } {
  if (requestedAllocation > maxAllocation) {
    return {
      valid: false,
      error: `Requested free allocation (${requestedAllocation}) exceeds network limit (${maxAllocation}). The current network supports a maximum of ${maxAllocation} free memberships per space.`,
    };
  }
  
  return { valid: true };
}

/**
 * Translate Solidity revert errors to user-friendly messages
 * 
 * @param error - The error object from the transaction
 * @returns User-friendly error message
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function translateContractError(error: any): string {
  const errorMessage = error?.message || error?.toString() || '';
  
  // Check for specific Solidity revert reasons
  if (errorMessage.includes('Membership__InvalidFreeAllocation')) {
    return 'The free allocation value exceeds the network limit. Please reduce the number of free memberships or contact support.';
  }
  
  if (errorMessage.includes('UNPREDICTABLE_GAS_LIMIT')) {
    return 'Transaction simulation failed. This may be due to invalid parameters or network limits. Please verify your space configuration.';
  }
  
  if (errorMessage.includes('insufficient funds')) {
    return 'Server wallet has insufficient funds to pay for gas. Please contact support.';
  }
  
  if (errorMessage.includes('nonce')) {
    return 'Transaction nonce error. Please try again in a few moments.';
  }
  
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return 'Transaction timed out. The transaction may still be processing. Please check the transaction status or try again.';
  }
  
  // Return original error message if no specific translation found
  return errorMessage;
}

/**
 * Wait for a transaction with timeout
 * Wraps Engine.waitForTransactionHash with a timeout to prevent hanging
 * 
 * @param waitFn - The async function to execute
 * @param timeoutMs - Timeout in milliseconds (default 60s)
 * @returns Promise that resolves with transaction result or rejects on timeout
 */
export async function waitWithTimeout<T>(
  waitFn: () => Promise<T>,
  timeoutMs: number = 60000
): Promise<T> {
  return Promise.race([
    waitFn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Transaction timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}
