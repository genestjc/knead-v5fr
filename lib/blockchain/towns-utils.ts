/**
 * $TOWNS Blockchain Utility Functions
 * 
 * Direct blockchain integration for querying balances and transferring tokens.
 * Replaces Supabase points system with on-chain source of truth.
 */

import { getContract, readContract, prepareContractCall, sendTransaction, toWei } from "thirdweb";
import { base } from "thirdweb/chains";
import { client as thirdwebClient } from "@/thirdweb-client";
import type { Address, Wallet } from "thirdweb/wallets";
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
      address: townsContractAddress as Address,
    });

    const balance = await readContract({
      contract,
      method: "function balanceOf(address account) view returns (uint256)",
      params: [walletAddress as Address],
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
 * @param contributorWallet - Contributor's wallet instance (must be connected)
 * @param participantAddress - Participant's wallet address
 * @param amount - Amount of $TOWNS tokens to award (as number)
 * @param eventId - Optional event ID for analytics
 * @returns Transaction hash and block number
 */
export async function awardTownsTokens(
  contributorWallet: Wallet,
  participantAddress: string,
  amount: number,
  eventId?: string
): Promise<{ transactionHash: string; blockNumber?: bigint }> {
  try {
    const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
    if (!townsContractAddress) {
      throw new Error("NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS is not set");
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: townsContractAddress as Address,
    });

    // Convert amount to wei (18 decimals)
    const amountInWei = toWei(amount.toString());

    // Prepare the transfer transaction
    const transaction = prepareContractCall({
      contract,
      method: "function transfer(address to, uint256 amount) returns (bool)",
      params: [participantAddress as Address, amountInWei],
    });

    // Send transaction from contributor's wallet
    const receipt = await sendTransaction({
      transaction,
      account: contributorWallet,
    });

    // Log to analytics (not source of truth)
    await logTransactionAnalytics({
      from: contributorWallet.address || "",
      to: participantAddress,
      amount,
      txHash: receipt.transactionHash,
      eventId: eventId || null,
      timestamp: Date.now(),
    });

    return {
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
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
      address: townsContractAddress as Address,
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
