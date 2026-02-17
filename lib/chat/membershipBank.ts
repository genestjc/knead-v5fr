
import { getContract, prepareContractCall, Engine, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { client, serverWallet, SERVER_WALLET_ADDRESS } from "../thirdweb-server-wallet";
import { logger } from "@/lib/logger";

const SPACE_ADDRESS = "0x616843f796b43e6ef972e7c345d2b06d85513543";
const BANK_MIN_THRESHOLD = 50;
const BANK_REFILL_AMOUNT = 250;

// Minimal ABI for Space Membership NFT (ERC-721)
const MEMBERSHIP_ABI = [
  {
    "inputs": [{"name": "owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "from", "type": "address"},
      {"name": "to", "type": "address"},
      {"name": "tokenId", "type": "uint256"}
    ],
    "name": "transferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "owner", "type": "address"},
      {"name": "index", "type": "uint256"}
    ],
    "name": "tokenOfOwnerByIndex",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "recipient", "type": "address"}],
    "name": "joinSpace",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export class MembershipBank {
  private contract;

  constructor() {
    this.contract = getContract({
      client,
      address: SPACE_ADDRESS,
      chain: base,
      abi: MEMBERSHIP_ABI,
    });
  }

  async getBankBalance(): Promise<number> {
    try {
      const balance = await readContract({
        contract: this.contract,
        method: "function balanceOf(address owner) view returns (uint256)",
        params: [SERVER_WALLET_ADDRESS],
      });
      return Number(balance);
    } catch (error) {
      logger.error("❌ Error getting bank balance:", error);
      return 0;
    }
  }

  async refillBank(amount: number = BANK_REFILL_AMOUNT) {
    logger.log(`🏦 Refilling bank with ${amount} Member NFTs...`);
    
    const batchSize = 10;
    let minted = 0;
    
    for (let i = 0; i < amount; i++) {
      try {
        const transaction = prepareContractCall({
          contract: this.contract,
          method: "function joinSpace(address recipient) returns (uint256)",
          params: [SERVER_WALLET_ADDRESS],
          gasLimit: 300000n,
        });

        const { transactionId } = await serverWallet.enqueueTransaction({
          transaction,
        });

        // Don't wait for every single one - just enqueue
        if ((i + 1) % batchSize === 0 || i === amount - 1) {
          logger.log(`✅ Enqueued ${i + 1}/${amount} mints`);
        }
        
        minted++;
      } catch (error) {
        logger.error(`❌ Error minting NFT ${i + 1}:`, error);
      }
    }
    
    logger.log(`🎉 Bank refill complete! Enqueued ${minted} mints`);
    
    // Wait a bit for them to process
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const newBalance = await this.getBankBalance();
    logger.log(`📊 New bank balance: ${newBalance}`);
    
    return newBalance;
  }

  async transferToUser(userAddress: string): Promise<string | null> {
    try {
      const balance = await this.getBankBalance();
      
      if (balance === 0) {
        logger.error("🚨 Bank is empty! Need to refill");
        throw new Error("Membership bank is empty");
      }

      // Get the first token ID owned by server wallet
      const tokenId = await readContract({
        contract: this.contract,
        method: "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
        params: [SERVER_WALLET_ADDRESS, 0n],
      });

      logger.log(`📤 Transferring Member NFT #${tokenId} to ${userAddress}`);

      // Transfer it
      const transaction = prepareContractCall({
        contract: this.contract,
        method: "function transferFrom(address from, address to, uint256 tokenId)",
        params: [SERVER_WALLET_ADDRESS, userAddress, tokenId],
        gasLimit: 200000n,
      });

      const { transactionId } = await serverWallet.enqueueTransaction({
        transaction,
      });

      const { transactionHash } = await Engine.waitForTransactionHash({
        client,
        transactionId,
      });

      logger.log(`✅ Transferred Member NFT #${tokenId} to ${userAddress}`);
      logger.log(`🔗 https://basescan.org/tx/${transactionHash}`);

      // Check if we need to refill
      const newBalance = await this.getBankBalance();
      if (newBalance < BANK_MIN_THRESHOLD) {
        logger.log(`⚠️ Bank low (${newBalance}), triggering background refill...`);
        // Don't await - let it run in background
        this.refillBank().catch(err => 
          logger.error("❌ Background refill failed:", err)
        );
      }

      return transactionHash;
    } catch (error) {
      logger.error("❌ Error transferring membership:", error);
      return null;
    }
  }

  async userHasMembership(userAddress: string): Promise<boolean> {
    try {
      const balance = await readContract({
        contract: this.contract,
        method: "function balanceOf(address owner) view returns (uint256)",
        params: [userAddress],
      });
      return balance > 0n;
    } catch (error) {
      logger.error("❌ Error checking user membership:", error);
      return false;
    }
  }
}

// Singleton
let bankInstance: MembershipBank | null = null;

export function getMembershipBank(): MembershipBank {
  if (!bankInstance) {
    bankInstance = new MembershipBank();
  }
  return bankInstance;
}
