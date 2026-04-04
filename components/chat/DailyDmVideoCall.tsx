'use client';

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

  const iframeUrl = `${roomUrl}?t=${token}&userName=${encodeURIComponent(currentUserAddress)}`;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
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
      if (element.requestFullscreen) element.requestFullscreen();
      else if ((element as any).webkitRequestFullscreen) (element as any).webkitRequestFullscreen();
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const handleExitFullscreen = () => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
  };

  return (
    <div ref={containerRef} className="relative h-full bg-gray-900 flex flex-col">
      {/* Solid bar covers and blocks Daily's Leave button underneath */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gray-900 z-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="font-georgia-pro text-sm text-white font-medium">
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
            title="Close panel"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <iframe
        src={iframeUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="w-full h-full border-0"
      />
    </div>
  );
}
