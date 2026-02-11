'use client';

import { getIPFSGatewayUrl, isImageFile } from '@/lib/thirdweb/storage';
import { useState } from 'react';

interface FileMessageDisplayProps {
  fileName: string;
  ipfsUri: string;
  isCurrentUser: boolean;
}

export function FileMessageDisplay({ fileName, ipfsUri, isCurrentUser }: FileMessageDisplayProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const isImage = isImageFile(fileName);
  
  // ✅ Now synchronous - no async needed
  let gatewayUrl = '';
  try {
    gatewayUrl = getIPFSGatewayUrl(ipfsUri);
  } catch (error) {
    console.error('Failed to get gateway URL:', error);
    setImageError(true);
  }

  if (isImage) {
    if (imageError || !gatewayUrl) {
      return (
        <div
          className={`
            mt-2 flex items-center gap-2 p-3 rounded-lg border
            ${isCurrentUser 
              ? 'bg-blue-700 border-blue-500' 
              : 'bg-gray-100 border-gray-300'
            }
          `}
        >
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className={`text-sm font-medium ${isCurrentUser ? 'text-white' : 'text-gray-900'}`}>
              {fileName}
            </p>
            <p className={`text-xs ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
              Failed to load image
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-2">
        {!imageLoaded && (
          <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg mb-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            <p className="text-sm text-gray-600">Loading image...</p>
          </div>
        )}
        
        <img
          src={gatewayUrl}
          alt={fileName}
          className={`max-w-full max-h-64 rounded-lg object-contain ${imageLoaded ? 'block' : 'hidden'}`}
          loading="lazy"
          onLoad={() => {
            console.log('✅ Image loaded successfully');
            setImageLoaded(true);
          }}
          onError={(e) => {
            console.error('❌ Image failed to load:', gatewayUrl);
            setImageError(true);
          }}
          crossOrigin="anonymous"
        />
        
        {imageLoaded && (
          <p className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
            {fileName}
          </p>
        )}
      </div>
    );
  }

  // Non-image files
  if (!gatewayUrl) {
    return (
      <div className="mt-2 p-3 rounded-lg border bg-gray-100">
        <p className="text-sm text-red-600">Failed to load file</p>
      </div>
    );
  }

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
