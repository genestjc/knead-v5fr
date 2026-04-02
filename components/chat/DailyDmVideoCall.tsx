'use client';

/**
 * Peer-to-Peer Video Call Component for DMs (Iframe Approach)
 * 
 * Uses Daily.co's prebuilt UI in an iframe to avoid duplicate Daily instance errors.
 * The app already has a DailyProvider for event video, so we use iframe here instead.
 */

import React, { useRef, useState, useEffect } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Build iframe URL with token and settings
  const iframeUrl = `${roomUrl}?t=${token}&userName=${encodeURIComponent(currentUserAddress)}`;

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Listen for messages from Daily iframe (optional - for detecting when call ends)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Daily sends 'left-meeting' event when user leaves
      if (event.data?.action === 'left-meeting') {
        onClose();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onClose]);

  const handleFullscreen = () => {
    const element = containerRef.current;
    if (!element) return;

    try {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        (element as any).mozRequestFullScreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const handleExitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen();
    }
  };

  return (
    <div ref={containerRef} className="relative h-full bg-gray-900 flex flex-col">
      {/* Top controls bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent z-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="font-georgia-pro text-sm text-white font-medium drop-shadow-lg">
            Video call with {otherUserName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={isFullscreen ? handleExitFullscreen : handleFullscreen}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-white" />
            ) : (
              <Maximize2 className="w-4 h-4 text-white" />
            )}
          </button>

          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 transition-colors"
            title="End call"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-40">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="font-georgia-pro text-gray-300">Connecting to video call...</p>
          </div>
        </div>
      )}

      {/* Daily.co iframe */}
      <iframe
        src={iframeUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="w-full h-full border-0"
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
