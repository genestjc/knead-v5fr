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
 * Upload a single file to IPFS with validation
 * 
 * @param file - File to upload
 * @returns IPFS URI (ipfs://...)
 */
export async function uploadToIPFS(file: File): Promise<string> {
  try {
    if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
      throw new Error("NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set");
    }

    // Validate file size (20MB max - handles high-res phone photos)
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_SIZE) {
      throw new Error('File too large. Maximum size is 20MB.');
    }
    
    // Validate file type - block dangerous file types
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
      // Documents
      'application/pdf', 'text/plain', 
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Video (small clips)
      'video/mp4', 'video/quicktime'
    ];
    
    const dangerousExtensions = [
      '.exe', '.bat', '.sh', '.app', '.dmg', '.scr', '.com', '.cmd', '.msi',
      '.ps1', '.vbs', '.jar', '.deb', '.rpm', '.run', '.bin', '.apk'
    ];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (dangerousExtensions.includes(fileExtension)) {
      throw new Error('File type not allowed for security reasons.');
    }
    
    if (!allowedTypes.includes(file.type) && file.type !== '') {
      // If type is empty, check extension (for some mobile uploads)
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];
      const docExtensions = ['.pdf', '.txt', '.doc', '.docx'];
      const videoExtensions = ['.mp4', '.mov'];
      const allowedExtensions = [...imageExtensions, ...docExtensions, ...videoExtensions];
      
      if (!allowedExtensions.includes(fileExtension)) {
        throw new Error('File type not supported. Allowed: images, PDFs, documents, small videos.');
      }
    }

    const uri = await upload({
      client,
      files: [file],
    });

    return uri;
  } catch (error) {
    console.error("Error uploading to IPFS:", error);
    throw error instanceof Error ? error : new Error('Failed to upload file to IPFS');
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

/**
 * Helper to check if file is an image
 * 
 * @param filename - File name to check
 * @returns True if the file is an image
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return imageExtensions.includes(ext);
}
