'use client';

import { useEffect, useRef, useState } from 'react';
import DailyIframe, { DailyCall, DailyEventObjectParticipant } from '@daily-co/daily-js';

interface VideoStageProps {
  roomUrl: string;
  userName: string;
  isHost?: boolean;
  isGuest?: boolean;
  onLeave?: () => void;
}

export function VideoStage({ 
  roomUrl, 
  userName, 
  isHost = false, 
  isGuest = false,
  onLeave,
}: VideoStageProps) {
  const callFrameRef = useRef<DailyCall | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [connectionState, setConnectionState] = useState<string>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [isSpeaker, setIsSpeaker] = useState(false);

  useEffect(() => {
    if (!roomUrl || !containerRef.current) return;

    const initializeCall = async () => {
      try {
        // Create Daily call frame
        const callFrame = DailyIframe.createFrame(containerRef.current!, {
          showLeaveButton: true,
          showFullscreenButton: true,
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: '0',
            borderRadius: '8px',
          },
        });

        callFrameRef.current = callFrame;

        // Determine if user is a speaker (host or guest)
        const canSpeak = isHost || isGuest;
        setIsSpeaker(canSpeak);

        // Set up event listeners
        callFrame
          .on('joined-meeting', () => {
            setConnectionState('connected');
            console.log('Joined video call');

            // Set permissions based on role
            if (!canSpeak) {
              // Audience mode: mute audio/video
              callFrame.setLocalAudio(false);
              callFrame.setLocalVideo(false);
            }
          })
          .on('left-meeting', () => {
            setConnectionState('disconnected');
            console.log('Left video call');
            onLeave?.();
          })
          .on('error', (error) => {
            console.error('Daily error:', error);
            setError(error?.errorMsg || 'Video connection error');
            setConnectionState('error');
          })
          .on('participant-joined', (event: DailyEventObjectParticipant) => {
            console.log('Participant joined:', event.participant.user_name);
          })
          .on('participant-left', (event) => {
            console.log('Participant left:', event.participant.user_name);
          });

        // Join the room
        await callFrame.join({
          url: roomUrl,
          userName: userName,
          startVideoOff: !canSpeak,
          startAudioOff: !canSpeak,
        });
      } catch (err) {
        console.error('Error initializing video call:', err);
        setError((err as Error).message || 'Failed to initialize video call');
        setConnectionState('error');
      }
    };

    initializeCall();

    // Cleanup on unmount
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }
    };
  }, [roomUrl, userName, isHost, isGuest, onLeave]);

  return (
    <div className="relative w-full h-full min-h-[500px] bg-gray-900 rounded-lg overflow-hidden">
      {/* Video container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Status overlays */}
      {connectionState === 'initializing' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Connecting to video...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-80">
          <div className="text-center px-4">
            <p className="text-white text-lg font-semibold mb-2">Connection Error</p>
            <p className="text-white text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Live indicator for speakers */}
      {connectionState === 'connected' && isSpeaker && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-full shadow-lg">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-sm font-semibold">LIVE</span>
        </div>
      )}

      {/* Audience mode indicator */}
      {connectionState === 'connected' && !isSpeaker && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-gray-700 text-white px-3 py-1.5 rounded-full shadow-lg">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          <span className="text-sm font-semibold">Audience Mode</span>
        </div>
      )}

      {/* Connection status */}
      <div className="absolute bottom-4 right-4 bg-gray-800 bg-opacity-90 text-white px-3 py-1.5 rounded-full text-xs">
        {connectionState === 'connected' && '🟢 Connected'}
        {connectionState === 'initializing' && '🟡 Connecting...'}
        {connectionState === 'disconnected' && '🔴 Disconnected'}
        {connectionState === 'error' && '🔴 Error'}
      </div>
    </div>
  );
}
