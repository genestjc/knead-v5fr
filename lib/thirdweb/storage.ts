/**
 * Convert IPFS URI to HTTP gateway URL
 * Uses ThirdWeb's gateway for better reliability
 */
export function getIPFSGatewayUrl(ipfsUri: string): string {
  if (!ipfsUri) {
    throw new Error("IPFS URI is required");
  }
  
  // If it's already an HTTP URL, return as-is
  if (ipfsUri.startsWith('http://') || ipfsUri.startsWith('https://')) {
    return ipfsUri;
  }

  // Convert ipfs:// to ThirdWeb gateway URL
  if (ipfsUri.startsWith('ipfs://')) {
    const hash = ipfsUri.replace('ipfs://', '');
    // ✅ Use ThirdWeb's gateway instead
    return `https://${hash}.ipfscdn.io`;
  }

  // If it's just a hash, add the gateway
  if (!ipfsUri.includes('://')) {
    return `https://${ipfsUri}.ipfscdn.io`;
  }

  throw new Error("Invalid IPFS URI format");
}
