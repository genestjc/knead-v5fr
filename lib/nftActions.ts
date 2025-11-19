import { getContract, prepareContractCall, Engine } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../app/abi/kneadMembershipABI.json";
import { client, serverWallet } from "../thirdweb-server-wallet";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const PREMIUM_TOKEN_ID = 1;
const FREEMIUM_TOKEN_ID = 0;

export async function mintPremiumNFT(walletAddress: string) {
  try {
    console.log(`Attempting to mint premium NFT for ${walletAddress}`);
    
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });
    
    // Idempotency: only mint if not already owned
    const balance = await balanceOf({
      contract,
      owner: walletAddress,
      tokenId: BigInt(PREMIUM_TOKEN_ID),
    });
    
    if (balance > 0n) {
      console.log(`User ${walletAddress} already has premium token, skipping mint`);
      return { success: true, alreadyMinted: true };
    }
    
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
    
    console.log(`Premium NFT minted successfully: ${transactionHash}`);
    return { success: true, transactionHash, transactionId };
  } catch (error: any) {
    console.error("Error minting premium NFT:", error);
    throw new Error(`Failed to mint premium NFT: ${error.message}`);
  }
}

export async function burnPremiumNFT(walletAddress: string) {
  try {
    console.log(`Attempting to burn premium NFT from ${walletAddress}`);
    
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });
    
    // Idempotency: only burn if owned
    const balance = await balanceOf({
      contract,
      owner: walletAddress,
      tokenId: BigInt(PREMIUM_TOKEN_ID),
    });
    
    if (balance === 0n) {
      console.log(`User ${walletAddress} does not have premium token, skipping burn`);
      return { success: true, notOwned: true };
    }
    
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
    
    console.log(`Premium NFT burned successfully: ${transactionHash}`);
    return { success: true, transactionHash, transactionId };
  } catch (error: any) {
    console.error("Error burning premium NFT:", error);
    throw new Error(`Failed to burn premium NFT: ${error.message}`);
  }
}

export async function mintFreemiumNFT(walletAddress: string) {
  try {
    console.log(`Attempting to mint freemium NFT for ${walletAddress}`);
    
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });
    
    // Idempotency: only mint if not already owned
    const balance = await balanceOf({
      contract,
      owner: walletAddress,
      tokenId: BigInt(FREEMIUM_TOKEN_ID),
    });
    
    if (balance > 0n) {
      console.log(`User ${walletAddress} already has freemium token, skipping mint`);
      return { success: true, alreadyMinted: true };
    }
    
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
    
    console.log(`Freemium NFT minted successfully: ${transactionHash}`);
    return { success: true, transactionHash, transactionId };
  } catch (error: any) {
    console.error("Error minting freemium NFT:", error);
    throw new Error(`Failed to mint freemium NFT: ${error.message}`);
  }
}
