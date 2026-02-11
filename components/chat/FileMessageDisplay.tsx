'use client';

import { MediaRenderer } from "thirdweb/react";
import { isImageFile } from '@/lib/thirdweb/storage';
import { client } from '@/lib/thirdweb-client'; // ✅ Use your existing client

interface FileMessageDisplayProps {
  fileName: string;
  ipfsUri: string;
  isCurrentUser: boolean;
}

export function FileMessageDisplay({ fileName, ipfsUri, isCurrentUser }: FileMessageDisplayProps) {
  const isImage = isImageFile(fileName);

  if (isImage) {
    return (
      <div className="mt-2">
        {/* ✅ Use ThirdWeb's MediaRenderer - handles authentication automatically */}
        <MediaRenderer
          client={client}
          src={ipfsUri}
          alt={fileName}
          className="max-w-full max-h-64 rounded-lg object-contain"
        />
        <p className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
          {fileName}
        </p>
      </div>
    );
  }

  // Non-image files - use manual gateway for download
  const gatewayUrl = `https://ipfs.io/ipfs/${ipfsUri.replace('ipfs://', '')}`;

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
