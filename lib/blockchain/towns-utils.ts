/**
 * USDC Blockchain Utility Functions
 * 
 * Direct blockchain integration for querying balances and transferring tokens.
 * Replaces Supabase points system with on-chain source of truth.
 */

import { getContract, readContract, prepareContractCall, sendTransaction, toWei } from "thirdweb";
import { base } from "thirdweb/chains";
import { client as thirdwebClient } from "@/thirdweb-client";
import type { Account } from "thirdweb/wallets";
import { logTransactionAnalytics } from "@/lib/analytics/transaction-logger";

/**
 * Query user's USDC balance directly from blockchain
 * 
 * @param walletAddress - User's wallet address
 * @returns Balance in USDC (as number with 6 decimal places)
 */
export async function getUserTownsBalance(walletAddress: string): Promise<number> {
  try {
    const usdcContractAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS;
    if (!usdcContractAddress) {
      throw new Error("NEXT_PUBLIC_USDC_ADDRESS is not set");
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: usdcContractAddress,
    });

    const balance = await readContract({
      contract,
      method: "function balanceOf(address account) view returns (uint256)",
      params: [walletAddress],
    });

    // Convert from smallest unit (6 decimals) to USDC
    return Number(balance) / 1e6;
  } catch (error) {
    console.error("Error fetching USDC balance:", error);
    throw new Error(
      `Failed to fetch USDC balance: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Award USDC tokens directly from contributor wallet to participant
 * 
 * @param contributorAccount - Contributor's account instance (must be connected)
 * @param participantAddress - Participant's wallet address
 * @param amount - Amount of USDC tokens to award (as number)
 * @param eventId - Optional event ID for analytics
 * @returns Transaction hash
 */
export async function awardTownsTokens(
  contributorAccount: Account,
  participantAddress: string,
  amount: number,
  eventId?: string
): Promise<{ transactionHash: string }> {
  try {
    const usdcContractAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS;
    if (!usdcContractAddress) {
      throw new Error("NEXT_PUBLIC_USDC_ADDRESS is not set");
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: usdcContractAddress,
    });

    // Convert amount to smallest unit (6 decimals)
    const amountInWei = toWei(amount.toString());

    // Prepare the transfer transaction
    const transaction = prepareContractCall({
      contract,
      method: "function transfer(address to, uint256 amount) returns (bool)",
      params: [participantAddress, amountInWei],
    });

    // Send transaction from contributor's account
    const receipt = await sendTransaction({
      transaction,
      account: contributorAccount,
    });

    // Log to analytics (not source of truth)
    await logTransactionAnalytics({
      from: contributorAccount.address,
      to: participantAddress,
      amount,
      txHash: receipt.transactionHash,
      eventId: eventId || null,
      timestamp: Date.now(),
    });

    return {
      transactionHash: receipt.transactionHash,
    };
  } catch (error) {
    console.error("Error awarding USDC tokens:", error);
    throw new Error(
      `Failed to award USDC tokens: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get total supply of USDC tokens
 * 
 * @returns Total supply in USDC
 */
export async function getTownsTotalSupply(): Promise<number> {
  try {
    const usdcContractAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS;
    if (!usdcContractAddress) {
      throw new Error("NEXT_PUBLIC_USDC_ADDRESS is not set");
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: usdcContractAddress,
    });

    const totalSupply = await readContract({
      contract,
      method: "function totalSupply() view returns (uint256)",
      params: [],
    });

    // Convert from smallest unit to USDC
    return Number(totalSupply) / 1e6;
  } catch (error) {
    console.error("Error fetching USDC total supply:", error);
    throw new Error(
      `Failed to fetch total supply: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
