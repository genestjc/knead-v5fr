'use client';

/**
 * File Message Display Component
 * Renders file messages with proper display for images and download links for other files
 */
import { getIPFSGatewayUrl, isImageFile } from '@/lib/thirdweb/storage';
import { useState, useEffect } from 'react';

interface FileMessageDisplayProps {
  fileName: string;
  ipfsUri: string;
  isCurrentUser: boolean;
}

export function FileMessageDisplay({ fileName, ipfsUri, isCurrentUser }: FileMessageDisplayProps) {
  const [gatewayUrl, setGatewayUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  
  const isImage = isImageFile(fileName);

  // ✅ Resolve IPFS URI to gateway URL
  useEffect(() => {
    async function resolveUri() {
      try {
        const url = await getIPFSGatewayUrl(ipfsUri);
        setGatewayUrl(url);
      } catch (error) {
        console.error('Failed to resolve IPFS URI:', error);
        setImageError(true);
      } finally {
        setIsLoading(false);
      }
    }

    resolveUri();
  }, [ipfsUri]);

  if (isLoading) {
    return (
      <div className="mt-2 flex items-center gap-2 p-3 rounded-lg border bg-gray-100">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        <p className="text-sm text-gray-600">Loading file...</p>
      </div>
    );
  }

  if (isImage) {
    if (imageError || !gatewayUrl) {
      // Fallback UI for failed image loads
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
          <div>
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
        <img
          src={gatewayUrl}
          alt={fileName}
          className="max-w-full max-h-64 rounded-lg object-contain"
          loading="lazy"
          onError={() => setImageError(true)}
        />
        <p className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
          {fileName}
        </p>
      </div>
    );
  }

  // Non-image files - download link
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
