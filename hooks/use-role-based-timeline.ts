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
 * Uses documented TimelineEvent property
 */
function getEventTimestamp(event: unknown): number {
  const e = event as { createdAtEpochMs?: number };
  return e.createdAtEpochMs ?? 0;
}

/**
 * Hook that subscribes to all channels and returns a merged timeline
 * 
 * If virtual sharding is not enabled, falls back to single channel behavior
 */
export function useRoleBasedTimeline(fallbackChannelId?: string): UseRoleBasedTimelineResult {
  const isShardingEnabled = isVirtualShardingEnabled();
  const channelIds = getAllChannelIds();

  // Subscribe to timelines
  // Note: When sharding disabled, only timeline1 is used (see early return below)
  const timeline1 = useTimeline(fallbackChannelId || channelIds[0]);
  const timeline2 = useTimeline(channelIds[1] || channelIds[0]);
  const timeline3 = useTimeline(channelIds[2] || channelIds[0]);
  const timeline4 = useTimeline(channelIds[3] || channelIds[0]);

  // Merge and sort timelines
  const mergedTimeline = useMemo(() => {
    // If sharding not enabled, return single timeline (no duplicates)
    if (!isShardingEnabled) {
      return {
        data: timeline1.data,
        isLoading: timeline1.isLoading,
        error: timeline1.error || null,
      };
    }

    // Check loading status
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

    // ✅ Deduplicate by eventId (handles any duplicate subscriptions)
    const seen = new Set<string>();
    const deduped = sorted.filter((e: any) => {
      if (!e.eventId) return true; // Keep events without eventId (shouldn't happen)
      if (seen.has(e.eventId)) return false;
      seen.add(e.eventId);
      return true;
    });

    console.log(`📊 Merged timeline: ${deduped.length} unique events from ${channelIds.length} channels (${allEvents.length} total before dedup)`);

    return {
      data: deduped,
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
