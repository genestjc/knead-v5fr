/**
 * ThirdWeb Storage - IPFS Upload Utilities
 * 
 * Provides functions for uploading files to IPFS via ThirdWeb's storage SDK.
 * Used for contributor profile avatars and media uploads.
 */

import { createThirdwebClient } from "thirdweb";
import { upload } from "thirdweb/storage";

// Initialize ThirdWeb client
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

/**
 * Upload a single file to IPFS
 * 
 * @param file - File to upload
 * @returns IPFS URI (ipfs://...)
 */
export async function uploadToIPFS(file: File): Promise<string> {
  try {
    if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
      throw new Error("NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set");
    }

    const uri = await upload({
      client,
      files: [file],
    });

    return uri;
  } catch (error) {
    console.error("Error uploading to IPFS:", error);
    throw new Error(`Failed to upload file to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload multiple files to IPFS
 * 
 * @param files - Array of files to upload
 * @returns Array of IPFS URIs
 */
export async function uploadMultipleToIPFS(files: File[]): Promise<string[]> {
  try {
    if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
      throw new Error("NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set");
    }

    const uris = await Promise.all(
      files.map(file => upload({
        client,
        files: [file],
      }))
    );

    return uris;
  } catch (error) {
    console.error("Error uploading multiple files to IPFS:", error);
    throw new Error(`Failed to upload files to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert IPFS URI to HTTP gateway URL
 * 
 * @param ipfsUri - IPFS URI (ipfs://...)
 * @returns HTTPS gateway URL
 */
export function getIPFSGatewayUrl(ipfsUri: string): string {
  if (!ipfsUri) {
    throw new Error("IPFS URI is required");
  }

  // If it's already an HTTP URL, return as-is
  if (ipfsUri.startsWith('http://') || ipfsUri.startsWith('https://')) {
    return ipfsUri;
  }

  // Convert ipfs:// to gateway URL
  if (ipfsUri.startsWith('ipfs://')) {
    const hash = ipfsUri.replace('ipfs://', '');
    return `https://gateway.ipfscdn.io/ipfs/${hash}`;
  }

  // If it's just a hash, add the gateway
  if (!ipfsUri.includes('://')) {
    return `https://gateway.ipfscdn.io/ipfs/${ipfsUri}`;
  }

  throw new Error("Invalid IPFS URI format");
}
