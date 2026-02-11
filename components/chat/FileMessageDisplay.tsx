'use client';

import { getIPFSGatewayUrl, isImageFile } from '@/lib/thirdweb/storage';
import { useState } from 'react';

interface FileMessageDisplayProps {
  fileName: string;
  ipfsUri: string;
  isCurrentUser: boolean;
}

export function FileMessageDisplay({ fileName, ipfsUri, isCurrentUser }: FileMessageDisplayProps) {
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  
  // Try multiple gateways
  const gateways = [
    'https://ipfs.io/ipfs',
    'https://cloudflare-ipfs.com/ipfs',
    'https://dweb.link/ipfs',
    'https://gateway.ipfscdn.io/ipfs',
  ];
  
  const hash = ipfsUri.replace('ipfs://', '');
  const gatewayUrl = `${gateways[gatewayIndex]}/${hash}`;
  
  const isImage = isImageFile(fileName);

  const handleImageError = () => {
    // Try next gateway
    if (gatewayIndex < gateways.length - 1) {
      console.log(`⚠️ Gateway ${gatewayIndex} failed, trying next...`);
      setGatewayIndex(gatewayIndex + 1);
    } else {
      console.error('❌ All gateways failed');
      setImageError(true);
    }
  };

  if (isImage) {
    if (imageError) {
      // Fallback UI for failed image loads
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
          <span className="text-2xl">📷</span>
          <div>
            <p className={`text-sm font-medium ${isCurrentUser ? 'text-white' : 'text-gray-900'}`}>
              {fileName}
            </p>
            <p className={`text-xs ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
              Click to view image
            </p>
          </div>
        </a>
      );
    }

    return (
      <div className="mt-2">
        <img
          src={gatewayUrl}
          alt={fileName}
          className="max-w-full max-h-64 rounded-lg object-contain"
          loading="lazy"
          onError={handleImageError}
        />
        <p className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
          {fileName}
        </p>
      </div>
    );
  }

  // Non-image files - download link
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
