import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ActionType } from '@/types/chat';

const pointValues: Record<ActionType, number> = {
  timely_question: 8,
  substantive_comment: 6,
  insightful_response: 7, // Assuming this maps to insightful_reaction
  creative_contribution: 10, // Assuming this maps to original_content
  helpful_clarification: 5, // Assuming this maps to threaded_reply
  thoughtful_followup: 5, // Can also map to threaded_reply
  simple_like: 2,
};

const getBasePointsForAction = (actionType: ActionType): number => {
  return pointValues[actionType] || 0;
};

/**
 * POST /api/chat/award-points
 * 
 * This is the new, upgraded endpoint.
 * It now acts as a secure proxy to the `award_points_atomic` RPC function in the database,
 * ensuring all point awards are transactional and secure.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contributorId, participantId, actionType, eventId } = body;

    // --- Validation ---
    if (!contributorId || !participantId || !actionType) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: contributorId, participantId, actionType' },
        { status: 400 }
      );
    }
    
    // --- Authorization (early check) ---
    if (contributorId === participantId) {
        return NextResponse.json({ success: false, error: 'You cannot award points to yourself.' }, { status: 403 });
    }

    const basePoints = getBasePointsForAction(actionType as ActionType);
    if (basePoints === 0) {
      return NextResponse.json(
        { success: false, error: `Invalid action type: ${actionType}` },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // --- Call the Atomic Database Function ---
    const { data, error: rpcError } = await supabase.rpc('award_points_atomic', {
      p_contributor_id: contributorId,
      p_participant_id: participantId,
      p_event_id: eventId, // Can be null if the award is not tied to an event
      p_base_points: basePoints,
      p_action_type: actionType,
    });

    // --- Handle Response ---
    if (rpcError) {
      // The RPC function raises specific, user-friendly exceptions.
      console.error('Supabase RPC Error from award_points_atomic:', rpcError);
      return NextResponse.json({ success: false, error: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      calculation: data, // The RPC function returns a JSON object with the calculated points
      message: `Successfully awarded points!`,
    });

  } catch (error: any) {
    console.error('Point award API error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected internal server error occurred.' },
      { status: 500 }
    );
  }
}

// The existing GET function can remain as is.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contributorId = searchParams.get('contributorId');

    if (!contributorId) {
      return NextResponse.json(
        { success: false, error: 'Missing contributorId parameter' },
        { status: 400 }
      );
    }

    const { getContributorStats } = await import('@/lib/chat/calculate-points');
    const stats = await getContributorStats(contributorId);

    return NextResponse.json({
      success: true,
      stats,
    });

  } catch (error) {
    console.error('Error fetching contributor stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
