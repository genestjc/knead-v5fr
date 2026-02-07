'use client';

import React, { useEffect, useState } from 'react';
import { useDaily, useParticipantIds, useLocalSessionId, DailyCall } from '@daily-co/daily-react';
import DailyIframe from '@daily-co/daily-js';
import { DailyVideoTile } from './DailyVideoTile';
import type { ChatEvent } from '@/types/chat';

interface EventVideoStageProps {
  event: ChatEvent;
  currentUserAddress: string;
  roomUrl: string;
  token: string;
}

/**
 * EventVideoStage - Container for host + guest video tiles
 * Manages Daily.co call and displays video grid
 */
export function EventVideoStage({ event, currentUserAddress, roomUrl, token }: EventVideoStageProps) {
  const daily = useDaily();
  const participantIds = useParticipantIds();
  const localSessionId = useLocalSessionId();
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHost = currentUserAddress.toLowerCase() === event.hostId.toLowerCase();

  // Create and join Daily call
  useEffect(() => {
    if (!roomUrl || !token || callObject) return;

    async function joinCall() {
      try {
        setJoining(true);
        setError(null);

        // Create Daily call object
        const newCallObject = DailyIframe.createCallObject();
        setCallObject(newCallObject);

        // Join the room with token
        await newCallObject.join({
          url: roomUrl,
          token: token,
        });

        setJoining(false);
      } catch (err: any) {
        console.error('Failed to join Daily call:', err);
        setError(err.message || 'Failed to join video call');
        setJoining(false);
      }
    }

    joinCall();

    // Cleanup on unmount
    return () => {
      if (callObject) {
        callObject.leave().catch(console.error);
        callObject.destroy().catch(console.error);
      }
    };
  }, [roomUrl, token]);

  const handleLeaveCall = async () => {
    if (daily) {
      await daily.leave();
    }
  };

  const handleEndEvent = async () => {
    if (!isHost) return;
    
    if (confirm('Are you sure you want to end this event for everyone?')) {
      try {
        // Update event status to ended
        const response = await fetch(`/api/admin/events/${event.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminAddress: currentUserAddress,
            status: 'ended',
          }),
        });

        if (response.ok) {
          // Leave the call
          if (daily) {
            await daily.leave();
          }
          window.location.reload();
        } else {
          alert('Failed to end event. Please try again.');
        }
      } catch (error) {
        console.error('Error ending event:', error);
        alert('Failed to end event. Please try again.');
      }
    }
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center p-6">
          <p className="font-georgia-pro text-red-600 mb-4">❌ {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (joining || !daily) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-600">Joining video call...</p>
        </div>
      </div>
    );
  }

  // Find host and guest participants
  const remoteParticipants = participantIds.filter(id => id !== localSessionId);
  const hostParticipant = remoteParticipants[0]; // First remote is usually host
  const guestParticipant = remoteParticipants[1]; // Second remote is guest

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Video Grid */}
      <div className="flex-1 p-4">
        {/* Desktop/Tablet: Side-by-side */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-4 h-full">
          {/* Host Tile */}
          <div className="h-full">
            {localSessionId && isHost ? (
              <DailyVideoTile
                sessionId={localSessionId}
                label="You (Host)"
                isLocal={true}
              />
            ) : hostParticipant ? (
              <DailyVideoTile
                sessionId={hostParticipant}
                label="Host"
                isLocal={false}
              />
            ) : (
              <div className="h-full bg-gray-800 rounded-lg flex items-center justify-center">
                <p className="font-georgia-pro text-gray-400">Waiting for host...</p>
              </div>
            )}
          </div>

          {/* Guest Tile */}
          <div className="h-full">
            {localSessionId && !isHost ? (
              <DailyVideoTile
                sessionId={localSessionId}
                label="You"
                isLocal={true}
              />
            ) : guestParticipant ? (
              <DailyVideoTile
                sessionId={guestParticipant}
                label="Guest"
                isLocal={false}
              />
            ) : (
              <div className="h-full bg-gray-800 rounded-lg flex items-center justify-center">
                <p className="font-georgia-pro text-gray-400">Waiting for guest...</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: Stacked vertically (handled by parent layout) */}
        <div className="lg:hidden h-full">
          {localSessionId && (
            <DailyVideoTile
              sessionId={localSessionId}
              label={isHost ? "You (Host)" : "You"}
              isLocal={true}
            />
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-georgia-pro text-sm font-semibold text-red-600">LIVE</span>
            </div>
            <span className="font-georgia-pro text-sm text-gray-600">
              {participantIds.length} participant{participantIds.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isHost ? (
              <button
                onClick={handleEndEvent}
                className="px-6 py-2 bg-red-600 text-white rounded-full font-georgia-pro hover:bg-red-700 transition"
              >
                End Event
              </button>
            ) : (
              <button
                onClick={handleLeaveCall}
                className="px-6 py-2 bg-gray-600 text-white rounded-full font-georgia-pro hover:bg-gray-700 transition"
              >
                Leave Call
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
