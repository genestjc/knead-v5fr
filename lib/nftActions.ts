import { prepareContractCall, Engine } from "thirdweb";
import { getMembershipContract } from "./contracts/getters";
import { checkTokenOwnership } from "./contracts/helpers";
import { client, serverWallet } from "../thirdweb-server-wallet";
import { logger } from "./logger";

const PREMIUM_TOKEN_ID = 1;
const FREEMIUM_TOKEN_ID = 0;

export async function mintPremiumNFT(walletAddress: string) {
  try {
    logger.debug(`Attempting to mint premium NFT for ${walletAddress}`);
    
    // Idempotency: only mint if not already owned
    const { owned } = await checkTokenOwnership(walletAddress, BigInt(PREMIUM_TOKEN_ID));
    
    if (owned) {
      logger.debug(`User already has premium token, skipping mint`);
      return { success: true, alreadyMinted: true };
    }
    
    const contract = getMembershipContract();
    
    // Prepare transaction with explicit gas settings
    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [walletAddress, BigInt(PREMIUM_TOKEN_ID), 1n],
      gasLimit: 300000n,
    });
    
    // Use Engine Server Wallet to enqueue transaction
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });
    
    // Wait for transaction hash
    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });
    
    logger.logTransaction("Premium NFT minted successfully", transactionHash);
    return { success: true, transactionHash, transactionId };
  } catch (error: any) {
    logger.error("Error minting premium NFT:", error);
    throw new Error(`Failed to mint premium NFT: ${error.message}`);
  }
}

export async function burnPremiumNFT(walletAddress: string) {
  try {
    logger.debug(`Attempting to burn premium NFT from ${walletAddress}`);
    
    // Idempotency: only burn if owned
    const { owned } = await checkTokenOwnership(walletAddress, BigInt(PREMIUM_TOKEN_ID));
    
    if (!owned) {
      logger.debug(`User does not have premium token, skipping burn`);
      return { success: true, notOwned: true };
    }
    
    const contract = getMembershipContract();
    
    // Prepare burn transaction with explicit gas settings
    const transaction = prepareContractCall({
      contract,
      method: "function adminBurn(address from, uint256 id, uint256 amount)",
      params: [walletAddress, BigInt(PREMIUM_TOKEN_ID), 1n],
      gasLimit: 300000n,
    });
    
    // Use Engine Server Wallet to enqueue transaction
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });
    
    // Wait for transaction hash
    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });
    
    logger.logTransaction("Premium NFT burned successfully", transactionHash);
    return { success: true, transactionHash, transactionId };
  } catch (error: any) {
    logger.error("Error burning premium NFT:", error);
    throw new Error(`Failed to burn premium NFT: ${error.message}`);
  }
}

export async function mintFreemiumNFT(walletAddress: string) {
  try {
    logger.debug(`Attempting to mint freemium NFT for ${walletAddress}`);
    
    // Idempotency: only mint if not already owned
    const { owned } = await checkTokenOwnership(walletAddress, BigInt(FREEMIUM_TOKEN_ID));
    
    if (owned) {
      logger.debug(`User already has freemium token, skipping mint`);
      return { success: true, alreadyMinted: true };
    }
    
    const contract = getMembershipContract();
    
    // Prepare transaction with explicit gas settings
    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [walletAddress, BigInt(FREEMIUM_TOKEN_ID), 1n],
      gasLimit: 300000n,
    });
    
    // Use Engine Server Wallet to enqueue transaction
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });
    
    // Wait for transaction hash
    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });
    
    logger.logTransaction("Freemium NFT minted successfully", transactionHash);
    return { success: true, transactionHash, transactionId };
  } catch (error: any) {
    logger.error("Error minting freemium NFT:", error);
    throw new Error(`Failed to mint freemium NFT: ${error.message}`);
  }
}
