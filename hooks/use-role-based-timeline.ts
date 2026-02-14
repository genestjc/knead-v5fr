/**
 * Role-Based Timeline Hook
 * 
 * Subscribes to all 4 channels and merges them into a single unified timeline.
 * Messages are sorted chronologically to provide seamless user experience.
 * 
 * This creates the illusion of a single channel while distributing messages
 * across multiple smaller channels for better performance.
 */

'use client';

import { useMemo } from 'react';
import { useTimeline } from '@towns-protocol/react-sdk';
import { getAllChannelIds, isVirtualShardingEnabled } from '@/lib/role-based-channel-router';

export interface UseRoleBasedTimelineResult {
  data: unknown[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Helper to extract timestamp from event object
 */
function getEventTimestamp(event: unknown): number {
  const e = event as { timestamp?: number; createdAt?: number };
  return e.timestamp ?? e.createdAt ?? 0;
}

/**
 * Hook that subscribes to all channels and returns a merged timeline
 * 
 * If virtual sharding is not enabled, falls back to single channel behavior
 */
export function useRoleBasedTimeline(fallbackChannelId?: string): UseRoleBasedTimelineResult {
  const isShardingEnabled = isVirtualShardingEnabled();
  const channelIds = getAllChannelIds();

  // Subscribe to all channels (or fallback to single channel)
  const timeline1 = useTimeline(isShardingEnabled ? channelIds[0] : fallbackChannelId || '');
  const timeline2 = useTimeline(isShardingEnabled ? channelIds[1] : '');
  const timeline3 = useTimeline(isShardingEnabled ? channelIds[2] : '');
  const timeline4 = useTimeline(isShardingEnabled ? channelIds[3] : '');

  // Merge and sort timelines
  const mergedTimeline = useMemo(() => {
    // If sharding not enabled, return single timeline
    if (!isShardingEnabled) {
      return {
        data: timeline1.data,
        isLoading: timeline1.isLoading,
        error: timeline1.error,
      };
    }

    // Check if any timeline is still loading
    const isLoading = 
      timeline1.isLoading || 
      timeline2.isLoading || 
      timeline3.isLoading || 
      timeline4.isLoading;

    // Collect any errors
    const error = 
      timeline1.error || 
      timeline2.error || 
      timeline3.error || 
      timeline4.error || 
      null;

    // If still loading or error, return early
    if (isLoading || error) {
      return {
        data: undefined,
        isLoading,
        error,
      };
    }

    // Merge all timelines
    const allEvents = [
      ...(timeline1.data || []),
      ...(timeline2.data || []),
      ...(timeline3.data || []),
      ...(timeline4.data || []),
    ];

    // Sort by timestamp (ascending order - oldest first)
    const sorted = allEvents.sort((a: unknown, b: unknown) => {
      return getEventTimestamp(a) - getEventTimestamp(b);
    });

    console.log(`📊 Merged timeline: ${allEvents.length} events from ${channelIds.length} channels`);

    return {
      data: sorted,
      isLoading: false,
      error: null,
    };
  }, [
    isShardingEnabled,
    timeline1.data,
    timeline1.isLoading,
    timeline1.error,
    timeline2.data,
    timeline2.isLoading,
    timeline2.error,
    timeline3.data,
    timeline3.isLoading,
    timeline3.error,
    timeline4.data,
    timeline4.isLoading,
    timeline4.error,
    channelIds.length,
  ]);

  return mergedTimeline;
}
