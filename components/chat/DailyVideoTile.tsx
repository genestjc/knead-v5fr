'use client';

import React from 'react';
import { DailyVideo, useDaily, useVideoTrack, useAudioTrack } from '@daily-co/daily-react';

interface DailyVideoTileProps {
  sessionId: string;
  label: string;
  isLocal?: boolean;
  isViewer?: boolean;
}

/**
 * DailyVideoTile - Individual video tile for a participant
 * Shows video/audio, participant name, and controls
 */
export function DailyVideoTile({ sessionId, label, isLocal = false, isViewer = false }: DailyVideoTileProps) {
  const daily = useDaily();
  const videoState = useVideoTrack(sessionId);
  const audioState = useAudioTrack(sessionId);

  const toggleCamera = () => {
    if (isLocal && daily) {
      daily.setLocalVideo(!daily.localVideo());
    }
  };

  const toggleMicrophone = () => {
    if (isLocal && daily) {
      daily.setLocalAudio(!daily.localAudio());
    }
  };

  return (
      <div className="relative bg-gray-900 rounded-lg overflow-hidden w-full h-full">
      {/* Daily's built-in video component */}
      <DailyVideo
        sessionId={sessionId}
        automirror={isLocal}
        type="video"
        className="w-full h-full object-cover"
        style={{ objectFit: 'cover' }}
      />

      {/* Video Off Placeholder */}
      {videoState.isOff && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl">👤</span>
            </div>
            <p className="font-georgia-pro text-white text-sm">{label}</p>
          </div>
        </div>
      )}

      {/* Label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-georgia-pro text-white text-sm font-semibold">{label}</span>
            {audioState.isOff && (
              <span className="text-red-500 text-xs">🔇</span>
            )}
          </div>
          
          {/* Local Controls (hidden for viewers) */}
          {isLocal && !isViewer && (
            <div className="flex gap-2">
              <button
                onClick={toggleMicrophone}
                className={`p-2 rounded-full ${audioState.isOff ? 'bg-red-500' : 'bg-white/20'} hover:bg-white/30 transition`}
                title={audioState.isOff ? 'Unmute' : 'Mute'}
              >
                {audioState.isOff ? '🔇' : '🎤'}
              </button>
              <button
                onClick={toggleCamera}
                className={`p-2 rounded-full ${videoState.isOff ? 'bg-red-500' : 'bg-white/20'} hover:bg-white/30 transition`}
                title={videoState.isOff ? 'Turn on camera' : 'Turn off camera'}
              >
                {videoState.isOff ? '📹' : '📷'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
