/**
 * Thirdweb Treasury Wallet Implementation
 *
 * Handles automated $TOWNS token withdrawals using Thirdweb v5 SDK.
 * - Treasury wallet is generated from THIRDWEB_PRIVATE_KEY (backend only)
 * - Sends ERC20 $TOWNS tokens on Base network
 * - Returns transaction hashes and block numbers for audit trail
 */

import { createThirdwebClient, toWei, getTransactionReceipt } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { base } from "thirdweb/chains";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  readContract,
} from "thirdweb";
import type { Address } from "thirdweb";

// Validate required environment variables
if (!process.env.THIRDWEB_SECRET_KEY) {
  throw new Error("❌ CRITICAL: THIRDWEB_SECRET_KEY must be set!");
}
if (!process.env.THIRDWEB_PRIVATE_KEY) {
  throw new Error("❌ CRITICAL: THIRDWEB_PRIVATE_KEY must be set!");
}

// Create Thirdweb client using secret key
export const thirdwebClient = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY,
});

/**
 * Get the Treasury wallet account from private key
 */
export function getTreasuryWallet() {
  return privateKeyToAccount({
    client: thirdwebClient,
    privateKey: process.env.THIRDWEB_PRIVATE_KEY!,
  });
}

/**
 * Get the Treasury wallet address
 */
export function getTreasuryAddress(): string {
  const wallet = getTreasuryWallet();
  return wallet.address;
}

/**
 * Send $TOWNS ERC20 tokens from Treasury to recipient
 *
 * @param recipientAddress - Ethereum address to send tokens to
 * @param amount - Amount of $TOWNS tokens (as string, e.g., "100" for 100 TOWNS)
 * @returns Transaction hash and block number
 */
export async function sendTownsTokens(
  recipientAddress: Address,
  amount: string,
): Promise<{ transactionHash: string; blockNumber: bigint }> {
  try {
    const wallet = getTreasuryWallet();
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

    const result = await sendTransaction({
      transaction,
      account: wallet,
    });

    // Fetch block number from receipt
    const receipt = await getTransactionReceipt({
      client: thirdwebClient,
      chain: base,
      transactionHash: result.transactionHash,
    });

    return {
      transactionHash: result.transactionHash,
      blockNumber: receipt.blockNumber,
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
    const wallet = getTreasuryWallet();
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
      params: [wallet.address],
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
