/**
 * $TOWNS Blockchain Utility Functions
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
 * Query user's $TOWNS balance directly from blockchain
 * 
 * @param walletAddress - User's wallet address
 * @returns Balance in $TOWNS tokens (as number with decimals)
 */
export async function getUserTownsBalance(walletAddress: string): Promise<number> {
  try {
    const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
    if (!townsContractAddress) {
      throw new Error("NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS is not set");
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: townsContractAddress,
    });

    const balance = await readContract({
      contract,
      method: "function balanceOf(address account) view returns (uint256)",
      params: [walletAddress],
    });

    // Convert from wei (18 decimals) to $TOWNS tokens
    return Number(balance) / 1e18;
  } catch (error) {
    console.error("Error fetching $TOWNS balance:", error);
    throw new Error(
      `Failed to fetch $TOWNS balance: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Award $TOWNS tokens directly from contributor wallet to participant
 * 
 * @param contributorAccount - Contributor's account instance (must be connected)
 * @param participantAddress - Participant's wallet address
 * @param amount - Amount of $TOWNS tokens to award (as number)
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
    const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
    if (!townsContractAddress) {
      throw new Error("NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS is not set");
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: townsContractAddress,
    });

    // Convert amount to wei (18 decimals)
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
    console.error("Error awarding $TOWNS tokens:", error);
    throw new Error(
      `Failed to award $TOWNS tokens: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get total supply of $TOWNS tokens
 * 
 * @returns Total supply in $TOWNS tokens
 */
export async function getTownsTotalSupply(): Promise<number> {
  try {
    const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
    if (!townsContractAddress) {
      throw new Error("NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS is not set");
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: townsContractAddress,
    });

    const totalSupply = await readContract({
      contract,
      method: "function totalSupply() view returns (uint256)",
      params: [],
    });

    // Convert from wei to $TOWNS
    return Number(totalSupply) / 1e18;
  } catch (error) {
    console.error("Error fetching $TOWNS total supply:", error);
    throw new Error(
      `Failed to fetch total supply: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
