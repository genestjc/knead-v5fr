import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const RSVP_REWARD = 2; // Points awarded just for RSVPing

/**
 * POST /api/events/[eventId]/rsvp
 * Creates an RSVP and now automatically awards the RSVP_REWARD.
 */
export async function POST(req: NextRequest, { params }: { params: { eventId: string } }) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'You must be logged in to RSVP.' }, { status: 401 });
  }

  // Use a transaction to ensure both actions succeed or fail together
  const { error } = await supabase.rpc('handle_rsvp_and_award_points', {
      p_event_id: params.eventId,
      p_user_id: session.user.id,
      p_points_to_award: RSVP_REWARD
  });

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      return NextResponse.json({ error: 'You have already RSVPd to this event.' }, { status: 409 });
    }
    console.error('RSVP RPC Error:', error);
    return NextResponse.json({ error: 'Could not process your RSVP.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `RSVP confirmed! You earned ${RSVP_REWARD} points.` });
}

/**
 * DELETE /api/events/[eventId]/rsvp
 * Deletes an RSVP and now reclaims the points awarded.
 */
export async function DELETE(req: NextRequest, { params }: { params: { eventId: string } }) {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 });
    }

    const { error } = await supabase.rpc('handle_cancel_rsvp_and_reclaim_points', {
      p_event_id: params.eventId,
      p_user_id: session.user.id,
      p_points_to_reclaim: RSVP_REWARD
    });
    
    if (error) {
        console.error('Cancel RSVP RPC Error:', error);
        return NextResponse.json({ error: 'Could not cancel your RSVP.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Your RSVP has been cancelled. ${RSVP_REWARD} points reclaimed.` });
}

// The GET function can remain the same
export async function GET(req: NextRequest, { params }: { params: { eventId: string } }) { /* ... existing code ... */ }
