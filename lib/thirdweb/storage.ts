/**
 * Convert IPFS URI to HTTP gateway URL with multiple fallbacks
 */
export function getIPFSGatewayUrl(ipfsUri: string, gatewayIndex: number = 0): string {
  if (!ipfsUri) {
    throw new Error("IPFS URI is required");
  }
  
  // Available gateways (ordered by reliability)
  const gateways = [
    'https://ipfs.io/ipfs',           // Most reliable
    'https://cloudflare-ipfs.com/ipfs', // Fast
    'https://dweb.link/ipfs',          // Alternative
    'https://gateway.ipfscdn.io/ipfs', // Original
  ];
  
  const gateway = gateways[gatewayIndex] || gateways[0];
  
  // If it's already an HTTP URL, return as-is
  if (ipfsUri.startsWith('http://') || ipfsUri.startsWith('https://')) {
    return ipfsUri;
  }

  // Convert ipfs:// to gateway URL
  if (ipfsUri.startsWith('ipfs://')) {
    const hash = ipfsUri.replace('ipfs://', '');
    return `${gateway}/${hash}`;
  }

  // If it's just a hash, add the gateway
  if (!ipfsUri.includes('://')) {
    return `${gateway}/${ipfsUri}`;
  }

  throw new Error("Invalid IPFS URI format");
}
