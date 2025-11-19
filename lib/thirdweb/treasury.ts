/**
 * Thirdweb Treasury Wallet Implementation
 *
 * Handles automated $TOWNS token withdrawals using Thirdweb Engine Server Wallet.
 * - Treasury wallet is managed by ThirdWeb Engine (no private keys!)
 * - Sends ERC20 $TOWNS tokens on Base network
 * - Returns transaction IDs and hashes for audit trail
 */

import {
  createThirdwebClient,
  toWei,
  Engine,
  getContract,
  prepareContractCall,
  readContract,
} from "thirdweb";
import { getRpcClient, eth_getTransactionReceipt } from "thirdweb/rpc";
import { base } from "thirdweb/chains";
import type { Address } from "thirdweb";

// Validate required environment variables
if (!process.env.THIRDWEB_SECRET_KEY) {
  throw new Error("❌ CRITICAL: THIRDWEB_SECRET_KEY must be set!");
}
if (!process.env.ENGINE_SERVER_WALLET_ADDRESS) {
  throw new Error("❌ CRITICAL: ENGINE_SERVER_WALLET_ADDRESS must be set!");
}
if (!process.env.ENGINE_VAULT_ACCESS_TOKEN) {
  throw new Error("❌ CRITICAL: ENGINE_VAULT_ACCESS_TOKEN must be set!");
}

// Create Thirdweb client using secret key
export const thirdwebClient = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY,
});

// Create Engine Server Wallet
export const treasuryServerWallet = Engine.serverWallet({
  client: thirdwebClient,
  address: process.env.ENGINE_SERVER_WALLET_ADDRESS,
  vaultAccessToken: process.env.ENGINE_VAULT_ACCESS_TOKEN,
});

// Treasury wallet address (managed by ThirdWeb Engine)
export const TREASURY_WALLET_ADDRESS = process.env.ENGINE_SERVER_WALLET_ADDRESS;

/**
 * Get the Treasury wallet address
 */
export function getTreasuryAddress(): string {
  return TREASURY_WALLET_ADDRESS;
}

/**
 * Send $TOWNS ERC20 tokens from Treasury to recipient
 *
 * @param recipientAddress - Ethereum address to send tokens to
 * @param amount - Amount of $TOWNS tokens (as string, e.g., "100" for 100 TOWNS)
 * @returns Transaction ID, hash, and block number
 */
export async function sendTownsTokens(
  recipientAddress: Address,
  amount: string,
): Promise<{ transactionId: string; transactionHash: string; blockNumber?: bigint }> {
  try {
    const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
    if (!townsContractAddress) {
      throw new Error("NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS is not set");
    }

    // Use toWei for precise conversion
    const amountInWei = toWei(amount);

    const contract = getContract({
      client: thirdwebClient,
      address: townsContractAddress as Address,
      chain: base,
    });

    const transaction = prepareContractCall({
      contract,
      method: "function transfer(address to, uint256 amount) returns (bool)",
      params: [recipientAddress, amountInWei],
    });

    // ThirdWeb Engine handles wallet management with Secret Key
    const { transactionId } = await treasuryServerWallet.enqueueTransaction({
      transaction,
    });

    // Wait for transaction hash
    const { transactionHash } = await Engine.waitForTransactionHash({
      client: thirdwebClient,
      transactionId,
    });

    // Try to fetch block number from receipt (optional, may fail if tx is still pending)
    let blockNumber: bigint | undefined;
    try {
      const rpcRequest = getRpcClient({ client: thirdwebClient, chain: base });
      const receipt = await eth_getTransactionReceipt(rpcRequest, {
        hash: transactionHash as `0x${string}`,
      });
      blockNumber = receipt.blockNumber;
    } catch (receiptError) {
      console.warn("Could not fetch transaction receipt:", receiptError);
      // Continue without block number
    }

    return {
      transactionId,
      transactionHash,
      blockNumber,
    };
  } catch (error) {
    console.error("Error sending TOWNS tokens:", error);
    throw new Error(
      `Failed to send TOWNS tokens: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Get Treasury wallet's $TOWNS token balance
 *
 * @returns Balance as string with 8 decimal places
 */
export async function getTreasuryBalance(): Promise<string> {
  try {
    const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
    if (!townsContractAddress) {
      throw new Error("NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS is not set");
    }

    const contract = getContract({
      client: thirdwebClient,
      address: townsContractAddress as Address,
      chain: base,
    });

    const balance = await readContract({
      contract,
      method: "function balanceOf(address account) view returns (uint256)",
      params: [TREASURY_WALLET_ADDRESS],
    });

    // Use BigInt for precision, format to 8 decimals
    const balanceInTowns = BigInt(balance) / 10n ** 18n;
    const remainder = BigInt(balance) % 10n ** 18n;
    const decimals = remainder.toString().padStart(18, "0").slice(0, 8);
    return `${balanceInTowns.toString()}.${decimals}`;
  } catch (error) {
    console.error("Error getting Treasury balance:", error);
    throw new Error(
      `Failed to get Treasury balance: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
