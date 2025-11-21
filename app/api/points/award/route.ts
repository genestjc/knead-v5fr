import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// This maps the action type from the frontend to the base points defined in your guide.
// We'll keep it simple for now. This could be expanded to check event type as well.
const getBasePointsForAction = (actionType: string): number => {
  const pointValues: { [key: string]: number } = {
    timely_question: 8,
    substantive_comment: 6,
    threaded_reply: 5,
    insightful_reaction: 7,
    simple_like: 2,
    original_content: 10,
  };
  return pointValues[actionType] || 0;
};

export async function POST(request: Request) {
  const { participantId, eventId, actionType } = await request.json();

  // Validate the incoming data
  if (!participantId || !actionType) {
    return NextResponse.json({ error: 'Missing required fields: participantId and actionType are required.' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });

  try {
    // 1. Get the current logged-in user (the contributor)
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized. You must be logged in to award points.' }, { status: 401 });
    }
    const contributorId = session.user.id;
    
    // Security check: Make sure user isn't awarding points to themselves.
    // The RPC function also checks this, but it's good practice to check early.
    if (contributorId === participantId) {
        return NextResponse.json({ error: 'You cannot award points to yourself.' }, { status: 403 });
    }

    // 2. Determine the base points for the action
    const basePoints = getBasePointsForAction(actionType);
    if (basePoints === 0) {
      return NextResponse.json({ error: `Invalid action type: ${actionType}` }, { status: 400 });
    }

    // 3. Call the atomic RPC function in the database
    const { data, error: rpcError } = await supabase.rpc('award_points_atomic', {
      p_contributor_id: contributorId,
      p_participant_id: participantId,
      p_event_id: eventId, // Can be null if the award is not tied to a specific event
      p_base_points: basePoints,
      p_action_type: actionType,
    });

    // 4. Handle errors from the database function
    if (rpcError) {
      // The RPC function will raise specific exceptions for business logic failures
      // (e.g., insufficient budget, cooldown active), which get caught here.
      console.error('Supabase RPC Error:', rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 400 });
    }

    // 5. Return the successful result from the RPC function
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Unhandled API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
}
