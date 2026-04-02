'use client';

import { useEffect, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';

interface LiveEventViewProps {
  event: {
    id: string;
    title: string;
    dailyRoomUrl: string;
    host: {
      displayName?: string;
      alias?: string;
    };
    guests: Array<{
      displayName?: string;
      alias?: string;
    }>;
  };
}

export function LiveEventView({ event }: LiveEventViewProps) {
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || callFrameRef.current) return;

    const callFrame = DailyIframe.createFrame(containerRef.current, {
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: '0',
      },
      showLeaveButton: true,
      showFullscreenButton: true,
      // Customize Daily.co UI
      theme: {
        colors: {
          accent: '#000000',
          accentText: '#ffffff',
          background: '#ffffff',
          backgroundAccent: '#f5f5f5',
          baseText: '#000000',
          border: '#e5e5e5',
          mainAreaBg: '#ffffff',
          mainAreaBgAccent: '#f9f9f9',
          mainAreaText: '#000000',
          supportiveText: '#666666',
        },
      },
    });

    callFrame.join({ url: event.dailyRoomUrl });

    callFrame.on('joined-meeting', () => {
      setIsLoading(false);
    });

    callFrame.on('error', (err: any) => {
      console.error('Daily.co error:', err);
      setIsLoading(false);
    });

    callFrameRef.current = callFrame;

    return () => {
      if (callFrame) {
        callFrame.destroy();
      }
    };
  }, [event.dailyRoomUrl]);

  return (
    <div className="w-full h-full bg-white relative">
      <div 
        ref={containerRef}
        className="w-full h-full"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
              <p className="font-georgia-pro text-gray-600">Connecting...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
