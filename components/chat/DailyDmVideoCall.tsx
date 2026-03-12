'use client';

/**
 * Peer-to-Peer Video Call Component for DMs
 *
 * Features:
 * - Uses Daily.co for 1-on-1 video calls (max 2 participants)
 * - Full-screen capable
 * - Audio/video toggle controls
 * - Exit button to return to text chat
 * - Mobile responsive (controls positioned at top to avoid keyboard overlap)
 * - Two-tile grid layout (local + remote participant)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  useDaily,
  useParticipantIds,
  useLocalSessionId,
  DailyAudio,
} from '@daily-co/daily-react';
import { DailyVideoTile } from './DailyVideoTile';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface DailyDmVideoCallProps {
  roomUrl: string;
  token: string;
  currentUserAddress: string;
  otherUserName: string;
  onClose: () => void;
}

const JOIN_TIMEOUT_MS = 15000;

export function DailyDmVideoCall({
  roomUrl,
  token,
  currentUserAddress,
  otherUserName,
  onClose,
}: DailyDmVideoCallProps) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const allParticipantIds = useParticipantIds();

  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const hasJoinedRef = useRef(false);
  const joinedRoomRef = useRef<string | null>(null);

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

  // Join the Daily room on mount
  useEffect(() => {
    if (!daily || !roomUrl || !token) return;
    if (hasJoinedRef.current && joinedRoomRef.current === roomUrl) return;

    const meetingState = daily.meetingState();
    if (meetingState === 'joined-meeting') {
      const participants = daily.participants();
      if (participants?.local?.session_id) return;
    }

    let isMounted = true;

    const joinCall = async () => {
      if (!isMounted) return;

      try {
        setJoining(true);
        setError(null);

        // Request camera/mic access
        try {
          await daily.startCamera({ url: roomUrl, token });
        } catch (camError: any) {
          console.warn('⚠️ Camera/mic request failed:', camError.message);
        }

        const joinPromise = daily.join({
          url: roomUrl,
          token,
          userName: currentUserAddress,
          startVideoOff: false,
          startAudioOff: false,
        });

        let timeoutId: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error(`Join timeout after ${JOIN_TIMEOUT_MS / 1000} seconds`)),
            JOIN_TIMEOUT_MS
          );
        });

        try {
          await Promise.race([joinPromise, timeoutPromise]);
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }

        if (!isMounted) {
          await daily.leave();
          return;
        }

        hasJoinedRef.current = true;
        joinedRoomRef.current = roomUrl;

        try {
          await daily.setLocalAudio(true);
          await daily.setLocalVideo(true);
        } catch (mediaError: any) {
          console.warn('⚠️ Could not enable media:', mediaError.message);
        }
      } catch (err: any) {
        console.error('❌ DM video join error:', err);
        if (isMounted) {
          setError(err.message || 'Failed to join video call');
          hasJoinedRef.current = false;
          joinedRoomRef.current = null;
        }
      } finally {
        if (isMounted) {
          setJoining(false);
        }
      }
    };

    joinCall();

    return () => {
      isMounted = false;
    };
  }, [daily, roomUrl, token, currentUserAddress]);

  // Leave call on unmount
  useEffect(() => {
    return () => {
      if (daily && daily.meetingState() === 'joined-meeting') {
        daily.leave().catch(console.error);
      }
    };
  }, [daily]);

  const handleClose = async () => {
    if (daily && daily.meetingState() === 'joined-meeting') {
      hasJoinedRef.current = false;
      joinedRoomRef.current = null;
      await daily.leave().catch(console.error);
    }
    onClose();
  };

  const handleFullscreen = () => {
    const element = videoContainerRef.current;
    if (!element) return;
    try {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        (element as any).mozRequestFullScreen();
      }
    } catch (err) {
      console.error('❌ Fullscreen error:', err);
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

  const remoteParticipantIds = allParticipantIds.filter((id) => id !== localSessionId);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center px-4">
          <p className="font-georgia-pro text-red-400 mb-4">❌ {error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setError(null);
                hasJoinedRef.current = false;
                joinedRoomRef.current = null;
              }}
              className="px-4 py-2 bg-white text-black rounded-full font-georgia-pro hover:bg-gray-200 transition"
            >
              Retry
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-700 text-white rounded-full font-georgia-pro hover:bg-gray-600 transition"
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (joining) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-300">Connecting to video call...</p>
        </div>
      </div>
    );
  }

  const totalTiles = (localSessionId ? 1 : 0) + remoteParticipantIds.length;
  const gridClass =
    totalTiles <= 1
      ? 'flex items-center justify-center'
      : 'grid grid-cols-1 md:grid-cols-2 gap-2';

  return (
    <div ref={videoContainerRef} className="relative h-full bg-gray-900 flex flex-col">
      <DailyAudio />

      {/* Top controls bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 z-30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="font-georgia-pro text-sm text-white">
            Video call with {otherUserName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={isFullscreen ? handleExitFullscreen : handleFullscreen}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-white" />
            ) : (
              <Maximize2 className="w-4 h-4 text-white" />
            )}
          </button>
          <button
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 transition"
            title="End call"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Video tiles */}
      <div className="flex-1 p-2 min-h-0">
        <div className={`h-full ${gridClass}`}>
          {localSessionId && (
            <div className="min-h-0 h-full overflow-hidden">
              <DailyVideoTile
                sessionId={localSessionId}
                label="You"
                isLocal={true}
                isViewer={false}
              />
            </div>
          )}

          {remoteParticipantIds.map((participantId) => (
            <div key={participantId} className="min-h-0 h-full overflow-hidden">
              <DailyVideoTile
                sessionId={participantId}
                label={otherUserName}
                isLocal={false}
                isViewer={false}
              />
            </div>
          ))}

          {remoteParticipantIds.length === 0 && (
            <div className="min-h-0 h-full bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
              <div className="text-center px-4">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl">👤</span>
                </div>
                <p className="font-georgia-pro text-gray-400 text-sm">
                  Waiting for {otherUserName} to join...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
