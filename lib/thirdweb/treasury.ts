/**
 * ThirdWeb Treasury Wallet Implementation
 * 
 * This module handles automated $TOWNS token withdrawals using ThirdWeb.
 * - Treasury wallet is generated from THIRDWEB_PRIVATE_KEY (no manual address needed)
 * - Sends ERC20 $TOWNS tokens from Base network
 * - Returns transaction hashes for audit trail
 */

import { createThirdwebClient } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { base } from "thirdweb/chains";
import { getContract, prepareContractCall, sendTransaction, readContract } from "thirdweb";
import type { Address } from "thirdweb";

// Validate required environment variables
if (!process.env.THIRDWEB_SECRET_KEY) {
  throw new Error("❌ CRITICAL: THIRDWEB_SECRET_KEY must be set!");
}

if (!process.env.THIRDWEB_PRIVATE_KEY) {
  throw new Error("❌ CRITICAL: THIRDWEB_PRIVATE_KEY must be set!");
}

// Create ThirdWeb client using secret key
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
  amount: string
): Promise<{ transactionHash: string; blockNumber: bigint }> {
  try {
    const wallet = getTreasuryWallet();
    
    // Get $TOWNS contract address from environment
    const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
    if (!townsContractAddress) {
      throw new Error("NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS is not set");
    }

    // Convert amount to wei (18 decimals for ERC20)
    const amountInWei = BigInt(Math.floor(parseFloat(amount) * 1e18));

    // Get the contract
    const contract = getContract({
      client: thirdwebClient,
      address: townsContractAddress as Address,
      chain: base,
    });

    // Prepare the ERC20 transfer call
    const transaction = prepareContractCall({
      contract,
      method: "function transfer(address to, uint256 amount) returns (bool)",
      params: [recipientAddress, amountInWei],
    });

    // Send the transaction
    const result = await sendTransaction({
      transaction,
      account: wallet,
    });

    // Note: sendTransaction returns { transactionHash, chain, client }
    // We'll get blockNumber from the receipt if needed in the future
    return {
      transactionHash: result.transactionHash,
      blockNumber: BigInt(0), // Block number can be fetched from receipt later if needed
    };
  } catch (error) {
    console.error("Error sending TOWNS tokens:", error);
    throw new Error(
      `Failed to send TOWNS tokens: ${error instanceof Error ? error.message : String(error)}`
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
    
    // Get $TOWNS contract address from environment
    const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
    if (!townsContractAddress) {
      throw new Error("NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS is not set");
    }

    // Get the contract
    const contract = getContract({
      client: thirdwebClient,
      address: townsContractAddress as Address,
      chain: base,
    });

    // Read the balance using ERC20 balanceOf
    const balance = await readContract({
      contract,
      method: "function balanceOf(address account) view returns (uint256)",
      params: [wallet.address],
    });

    // Convert from wei to TOWNS (divide by 1e18) and format to 8 decimals
    const balanceInTowns = Number(balance) / 1e18;
    return balanceInTowns.toFixed(8);
  } catch (error) {
    console.error("Error getting Treasury balance:", error);
    throw new Error(
      `Failed to get Treasury balance: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
