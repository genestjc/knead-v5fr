'use client';

import React, { useEffect, useState } from 'react';
import { useDaily, useParticipantIds, useLocalSessionId } from '@daily-co/daily-react';
import { DailyVideoTile } from './DailyVideoTile';
import type { ChatEvent } from '@/types/chat';

interface EventVideoStageProps {
  event: ChatEvent;
  currentUserAddress: string;
  roomUrl: string;
  token: string;
}

export function EventVideoStage({ event, currentUserAddress, roomUrl, token }: EventVideoStageProps) {
  const daily = useDaily();
  const participantIds = useParticipantIds();
  const localSessionId = useLocalSessionId();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHost = event.host?.id 
    ? currentUserAddress.toLowerCase() === event.host.id.toLowerCase() 
    : false;

  // ✅ FIX: Join call with proper cleanup and duplicate prevention
  useEffect(() => {
    if (!daily) {
      console.log('⏳ [EventVideoStage] Daily not ready yet');
      return;
    }
    
    if (!roomUrl || !token) {
      console.error('❌ [EventVideoStage] Missing roomUrl or token');
      return;
    }

    // ✅ FIX: Prevent duplicate joins
    const meetingState = daily.meetingState();
    if (meetingState === 'joined-meeting' || meetingState === 'joining-meeting') {
      console.log('✅ [EventVideoStage] Already joined/joining, skipping');
      setJoining(false);
      return;
    }
    
    let isMounted = true; // ✅ Track component mount state
    
    async function joinCall() {
      if (!isMounted) return;
      
      try {
        setJoining(true);
        setError(null);

        console.log('🎥 [EventVideoStage] Joining call...');
        console.log('   Room URL:', roomUrl);
        console.log('   Is Host:', isHost);
        console.log('   Meeting State:', daily.meetingState());

        await daily.join({
          url: roomUrl,
          token: token,
          userName: isHost ? 'Host' : 'Guest',
          userData: {
            role: isHost ? 'host' : 'guest',
            address: currentUserAddress,
          },
        });

        if (!isMounted) {
          console.log('⚠️ [EventVideoStage] Component unmounted during join, leaving...');
          await daily.leave();
          return;
        }

        console.log('✅ [EventVideoStage] Successfully joined call');
        console.log('   New Meeting State:', daily.meetingState());
        setJoining(false);
      } catch (err) {
        console.error('❌ [EventVideoStage] Failed to join:', err);
        if (isMounted) {
          setError((err as Error).message || 'Failed to join video call');
          setJoining(false);
        }
      }
    }

    joinCall();

    // ✅ Cleanup: Mark as unmounted and leave call
    return () => {
      isMounted = false;
      console.log('🧹 [EventVideoStage] Component unmounting');
      if (daily && daily.meetingState() === 'joined-meeting') {
        console.log('🚪 [EventVideoStage] Leaving call on cleanup');
        daily.leave().catch(console.error);
      }
    };
  }, [daily, roomUrl, token]); // ✅ Removed currentUserAddress and isHost from dependencies

  // ✅ Monitor connection state and errors
  useEffect(() => {
    if (!daily) return;

    const handleNetworkQuality = (event: any) => {
      console.log('📊 [EventVideoStage] Network quality:', event.threshold);
    };

    const handleError = (event: any) => {
      console.error('❌ [EventVideoStage] Daily error:', event);
      setError(event.errorMsg || 'Connection error');
    };

    const handleLeftMeeting = () => {
      console.log('👋 [EventVideoStage] Left meeting');
      setJoining(false);
    };

    const handleJoinedMeeting = () => {
      console.log('✅ [EventVideoStage] Joined meeting event fired');
      setJoining(false);
      setError(null);
    };

    daily.on('network-quality-change', handleNetworkQuality);
    daily.on('error', handleError);
    daily.on('left-meeting', handleLeftMeeting);
    daily.on('joined-meeting', handleJoinedMeeting);

    return () => {
      daily.off('network-quality-change', handleNetworkQuality);
      daily.off('error', handleError);
      daily.off('left-meeting', handleLeftMeeting);
      daily.off('joined-meeting', handleJoinedMeeting);
    };
  }, [daily]);

  const handleLeaveCall = async () => {
    if (daily) {
      console.log('🚪 [EventVideoStage] User manually leaving call');
      await daily.leave();
    }
  };

  const handleEndEvent = async () => {
    if (!isHost) return;
    
    if (confirm('Are you sure you want to end this event for everyone?')) {
      try {
        const response = await fetch(`/api/admin/events/${event.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminAddress: currentUserAddress,
            status: 'ended',
          }),
        });

        if (response.ok) {
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

  const remoteParticipants = participantIds.filter(id => id !== localSessionId);
  const hostParticipant = remoteParticipants[0];
  const guestParticipant = remoteParticipants[1];

  return (
    <div className="h-full flex flex-col bg-gray-100">
      <div className="flex-1 p-4">
        <div className="hidden lg:grid lg:grid-cols-2 gap-4 h-full">
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
