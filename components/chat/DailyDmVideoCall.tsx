'use client';

/**
 * Peer-to-Peer Video Call Component for DMs (Iframe Approach)
 * 
 * Uses Daily.co's prebuilt UI in an iframe to avoid duplicate Daily instance errors.
 * The app already has a DailyProvider for event video, so we use iframe here instead.
 */

import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface DailyDmVideoCallProps {
  roomUrl: string;
  token: string;
  currentUserAddress: string;
  otherUserName: string;
  onClose: () => void;
}

export function DailyDmVideoCall({
  roomUrl,
  token,
  currentUserAddress,
  otherUserName,
  onClose,
}: DailyDmVideoCallProps) {
  const iframeUrl = `${roomUrl}?t=${token}&userName=${encodeURIComponent(currentUserAddress)}`;

  // Listen for messages from Daily iframe (optional - for detecting when call ends)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.action === 'left-meeting') {
        onClose();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onClose]);

  return (
    <div className="relative h-full bg-gray-900 flex flex-col">
      {/* Top controls bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent z-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="font-georgia-pro text-sm text-white font-medium drop-shadow-lg">
            Video call with {otherUserName}
          </span>
        </div>

        <button
          onClick={onClose}
          className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 transition-colors"
          title="Close panel"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Daily.co iframe */}
      <iframe
        src={iframeUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="w-full h-full border-0"
      />
    </div>
  );
}
