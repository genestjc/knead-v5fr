import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/events/[eventId]/rsvp
 * Checks if the current logged-in user has an RSVP for a specific event.
 */
export async function GET(req: NextRequest, { params }: { params: { eventId: string } }) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ rsvp_status: 'unauthenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('rsvps')
    .select('id, status')
    .eq('event_id', params.eventId)
    .eq('chat_user_id', session.user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ rsvp_status: 'not_rsvpd' });
  }

  return NextResponse.json({ rsvp_status: data.status });
}


/**
 * POST /api/events/[eventId]/rsvp
 * Creates an RSVP for the current logged-in user for a specific event.
 */
export async function POST(req: NextRequest, { params }: { params: { eventId: string } }) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'You must be logged in to RSVP.' }, { status: 401 });
  }

  // TODO: Add logic to check if event is full before attempting to insert
  // This would involve fetching the event's rsvp_cap and current rsvp count.

  const { error } = await supabase
    .from('rsvps')
    .insert({
      event_id: params.eventId,
      chat_user_id: session.user.id,
      status: 'confirmed', // For now, we default to confirmed. Waitlist logic can be added later.
    });

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      return NextResponse.json({ error: 'You have already RSVPd to this event.' }, { status: 409 });
    }
    console.error('RSVP Error:', error);
    return NextResponse.json({ error: 'Could not process your RSVP at this time.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'RSVP confirmed!' });
}


/**
 * DELETE /api/events/[eventId]/rsvp
 * Deletes/cancels an RSVP for the current logged-in user.
 */
export async function DELETE(req: NextRequest, { params }: { params: { eventId: string } }) {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 });
    }

    const { error } = await supabase
        .from('rsvps')
        .delete()
        .eq('event_id', params.eventId)
        .eq('chat_user_id', session.user.id);
    
    if (error) {
        console.error('Cancel RSVP Error:', error);
        return NextResponse.json({ error: 'Could not cancel your RSVP.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Your RSVP has been cancelled.' });
}
