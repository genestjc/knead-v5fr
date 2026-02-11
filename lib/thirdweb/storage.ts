/**
 * ThirdWeb Storage - IPFS Upload Utilities
 * Provides functions for uploading files to IPFS via ThirdWeb's storage SDK.
 */
import { upload } from "thirdweb/storage";
import { client } from "../../thirdweb-client"; // ✅ Go up TWO levels to project root

/**
 * Upload a single file to IPFS with validation
 */
export async function uploadToIPFS(file: File): Promise<string> {
  try {
    const CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
    
    if (!CLIENT_ID) {
      throw new Error("NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set");
    }

    // Validate file size (20MB max)
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('File too large. Maximum size is 20MB.');
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
      'application/pdf', 'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];
      const docExtensions = ['.pdf', '.txt', '.doc', '.docx'];
      const videoExtensions = ['.mp4', '.mov'];
      const allowedExtensions = [...imageExtensions, ...docExtensions, ...videoExtensions];

      if (!allowedExtensions.includes(fileExtension)) {
        throw new Error('File type not supported. Allowed: images, PDFs, documents, small videos.');
      }
    }

    // ✅ Upload to IPFS using your existing client
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
 */
export async function uploadMultipleToIPFS(files: File[]): Promise<string[]> {
  try {
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
 * Helper to check if file is an image
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return imageExtensions.includes(ext);
}
