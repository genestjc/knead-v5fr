'use client';

import React from 'react';
import { DailyVideo, useVideoTrack, useAudioTrack, useDaily } from '@daily-co/daily-react';

interface DailyVideoTileProps {
  sessionId: string;
  label: string;
  isLocal: boolean;
  isViewer: boolean;
}

export function DailyVideoTile({ sessionId, label, isLocal, isViewer }: DailyVideoTileProps) {
  const daily = useDaily();
  const videoState = useVideoTrack(sessionId);
  const audioState = useAudioTrack(sessionId);

  const handleToggleVideo = () => {
    if (!daily || isViewer) return;
    daily.setLocalVideo(videoState.isOff);
  };

  const handleToggleAudio = () => {
    if (!daily || isViewer) return;
    daily.setLocalAudio(audioState.isOff);
  };

  return (
    <div className="relative w-full h-full bg-gray-950 rounded-lg overflow-hidden">
      <DailyVideo
        sessionId={sessionId}
        type="video"
        automirror={isLocal}
        className="w-full h-full object-cover"
      />

      <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/70 rounded-full z-40">
        <span className="text-white text-sm font-georgia-pro font-medium">{label}</span>
      </div>

      {isLocal && !isViewer && (
        <div className="absolute bottom-3 right-3 flex gap-2 z-50">
          <button
            onClick={handleToggleVideo}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
              videoState.isOff
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-white/20 hover:bg-white/30'
            }`}
            title={videoState.isOff ? 'Turn video on' : 'Turn video off'}
          >
            <span className="text-white text-sm">
              {videoState.isOff ? '📹' : '📷'}
            </span>
          </button>

          <button
            onClick={handleToggleAudio}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
              audioState.isOff
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-white/20 hover:bg-white/30'
            }`}
            title={audioState.isOff ? 'Unmute' : 'Mute'}
          >
            <span className="text-white text-sm">
              {audioState.isOff ? '🔇' : '🎤'}
            </span>
          </button>
        </div>
      )}

      {!isLocal && !isViewer && (
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/70 rounded-full z-40">
          <span className="text-white text-xs">
            {audioState.isOff ? '🔇' : '🔊'}
          </span>
        </div>
      )}

      {videoState.isOff && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-30">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-4xl">👤</span>
            </div>
            <p className="text-gray-400 text-sm font-georgia-pro">{label}</p>
          </div>
        </div>
      )}
    </div>
  );
}
