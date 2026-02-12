'use client';

import { MediaRenderer } from "thirdweb/react";
import { isImageFile } from '@/lib/thirdweb/storage';
import { client } from '@/thirdweb-client';
import { useState } from 'react';

interface FileMessageDisplayProps {
  fileName: string;
  ipfsUri: string;
  isCurrentUser: boolean;
}

/**
 * Convert IPFS URI to HTTP gateway URL for fallback links
 * Uses ThirdWeb's CDN gateway (same as MediaRenderer uses internally)
 */
function ipfsToGatewayUrl(ipfsUri: string): string {
  if (!ipfsUri) return '';
  
  // If already an HTTP URL, return as-is
  if (ipfsUri.startsWith('http://') || ipfsUri.startsWith('https://')) {
    return ipfsUri;
  }
  
  // ✅ Use thirdweb's CDN gateway (most reliable and performant)
  const cid = ipfsUri.replace('ipfs://', '');
  return `https://ipfs.thirdwebcdn.com/ipfs/${cid}`;
}

export function FileMessageDisplay({ fileName, ipfsUri, isCurrentUser }: FileMessageDisplayProps) {
  const [hasError, setHasError] = useState(false);
  const isImage = isImageFile(fileName);
  
  // Gateway URL for fallback links only
  const gatewayUrl = ipfsToGatewayUrl(ipfsUri);

  // If MediaRenderer failed, show download link
  if (hasError) {
    return (
      <a
        href={gatewayUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`
          mt-2 flex items-center gap-2 p-3 rounded-lg border transition-colors
          ${isCurrentUser 
            ? 'bg-blue-700 border-blue-500 hover:bg-blue-800' 
            : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
          }
        `}
      >
        <span className="text-2xl">{isImage ? '🖼️' : '📎'}</span>
        <div>
          <p className={`text-sm font-medium ${isCurrentUser ? 'text-white' : 'text-gray-900'}`}>
            {fileName}
          </p>
          <p className={`text-xs ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
            Click to {isImage ? 'view' : 'download'}
          </p>
        </div>
      </a>
    );
  }

  if (isImage) {
    return (
      <div className="mt-2">
        {/* ✅ Pass ipfs:// URI directly - MediaRenderer handles gateway conversion */}
        <MediaRenderer
          client={client}
          src={ipfsUri} // ✅ Pass raw ipfs:// URI
          alt={fileName}
          className="max-w-full max-h-64 rounded-lg object-contain"
          style={{ maxWidth: '100%', maxHeight: '16rem' }}
          onError={() => setHasError(true)} // ✅ Trigger fallback on error
        />
        <p className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
          {fileName}
        </p>
      </div>
    );
  }

  // Non-image files: Direct download link
  return (
    <a
      href={gatewayUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        mt-2 flex items-center gap-2 p-3 rounded-lg border transition-colors
        ${isCurrentUser 
          ? 'bg-blue-700 border-blue-500 hover:bg-blue-800' 
          : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
        }
      `}
    >
      <span className="text-2xl">📎</span>
      <div>
        <p className={`text-sm font-medium ${isCurrentUser ? 'text-white' : 'text-gray-900'}`}>
          {fileName}
        </p>
        <p className={`text-xs ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
          Click to download
        </p>
      </div>
    </a>
  );
}
