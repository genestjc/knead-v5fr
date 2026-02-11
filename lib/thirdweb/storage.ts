/**
 * ThirdWeb Storage - IPFS Upload Utilities
 * Provides functions for uploading files to IPFS via ThirdWeb's storage SDK.
 * Used for contributor profile avatars and media uploads.
 */
import { createThirdwebClient } from "thirdweb";
import { upload, download, resolveScheme } from "thirdweb/storage";

// Initialize ThirdWeb client
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

/**
 * Upload a single file to IPFS with validation
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
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Video (small clips)
      'video/mp4', 'video/quicktime'
    ];

    const dangerousExtensions = [
      '.exe', '.bat', '.sh', '.app', '.dmg', '.scr', '.com', '.cmd',
      '.msi', '.ps1', '.vbs', '.jar', '.deb', '.rpm', '.run', '.bin', '.apk'
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

    // ✅ Upload to IPFS via ThirdWeb
    const uri = await upload({
      client,
      files: [file],
    });

    console.log('✅ File uploaded to IPFS:', uri);
    return uri;
  } catch (error) {
    console.error("Error uploading to IPFS:", error);
    throw error instanceof Error ? error : new Error('Failed to upload file to IPFS');
  }
}

/**
 * Upload multiple files to IPFS
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
 * ✅ NEW: Convert IPFS URI to HTTPS gateway URL using ThirdWeb's authenticated gateway
 * @param ipfsUri - IPFS URI (ipfs://...)
 * @returns HTTPS gateway URL (protected by your API key)
 */
export async function getIPFSGatewayUrl(ipfsUri: string): Promise<string> {
  if (!ipfsUri) {
    throw new Error("IPFS URI is required");
  }

  if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
    throw new Error("NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set");
  }
  
  // If it's already an HTTP URL, return as-is
  if (ipfsUri.startsWith('http://') || ipfsUri.startsWith('https://')) {
    return ipfsUri;
  }

  // ✅ Use ThirdWeb's resolveScheme for authenticated gateway access
  try {
    const resolvedUri = await resolveScheme({
      client,
      uri: ipfsUri,
    });
    
    console.log('✅ IPFS URI resolved:', { original: ipfsUri, resolved: resolvedUri });
    return resolvedUri;
  } catch (error) {
    console.error('Error resolving IPFS URI:', error);
    
    // Fallback to manual construction if resolveScheme fails
    const hash = ipfsUri.replace('ipfs://', '');
    return `https://${process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}.ipfscdn.io/ipfs/${hash}`;
  }
}

/**
 * Download a file from IPFS
 * @param ipfsUri - IPFS URI (ipfs://...)
 * @returns Downloaded file data
 */
export async function downloadFromIPFS(ipfsUri: string): Promise<Response> {
  try {
    if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
      throw new Error("NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set");
    }

    const file = await download({
      client,
      uri: ipfsUri,
    });

    return file;
  } catch (error) {
    console.error("Error downloading from IPFS:", error);
    throw new Error(`Failed to download from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Helper to check if file is an image
 * @param filename - File name to check
 * @returns True if the file is an image
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return imageExtensions.includes(ext);
}
