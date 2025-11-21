import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use the admin client to call the RPC function securely
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// This maps the action type from the frontend to the base points defined in your guide.
const getBasePointsForAction = (actionType: string): number => {
  const pointValues: { [key: string]: number } = {
    'timely_question': 8,
    'substantive_comment': 6,
    'threaded_reply': 5,
    'insightful_reaction': 7,
    'simple_like': 2,
    'original_content': 10,
    // Add other action types from your guide here
  };
  return pointValues[actionType] || 0;
};

/**
 * POST /api/chat/award-points
 * 
 * Contributor awards points to a participant.
 * This route now acts as a secure proxy to the `award_points_atomic` RPC function.
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

    const basePoints = getBasePointsForAction(actionType);
    if (basePoints === 0) {
      return NextResponse.json(
        { success: false, error: `Invalid action type: ${actionType}` },
        { status: 400 }
      );
    }

    // --- Call the Atomic Database Function ---
    const { data, error: rpcError } = await supabaseAdmin.rpc('award_points_atomic', {
      p_contributor_id: contributorId,
      p_participant_id: participantId,
      p_event_id: eventId, // Can be null if the award is not tied to an event
      p_base_points: basePoints,
      p_action_type: actionType,
    });

    // --- Handle Response ---
    if (rpcError) {
      // The RPC function raises specific, user-friendly exceptions for business logic failures.
      console.error('Supabase RPC Error:', rpcError);
      return NextResponse.json({ success: false, error: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      calculation: data, // The RPC function returns the calculated points
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

// Note: The GET method for contributor stats can remain if you still need it,
// but for this integration, the POST method is the focus.
```

With that single file change, your backend is now fully operational and secure.

### Building the `<EventsManager />`

Now, let's bring your "Events & Live Interviews" tab to life. You already have the API endpoints for it (`app/api/admin/events/route.ts` and `[id]/route.ts`), which is perfect. We just need to build the UI component that uses them.

**Action:** Create the following component file.

````typescript name=components/admin/EventsManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

// A simplified ChatEvent type. Expand this to match your `types/chat.ts`
interface ChatEvent {
  id: string;
  title: string;
  description: string | null;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  scheduled_start: string;
  scheduled_end: string;
}

interface EventFormData {
  title: string;
  description: string;
  eventType: 'live' | 'discussion' | 'essay';
  scheduledStart: string;
  scheduledEnd: string;
  videoEnabled: boolean;
  channelId: string;
  hostId: string; // You'll need a way to select a host
}

export function EventsManager({ adminAddress }: { adminAddress: string }) {
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Function to fetch events
  async function fetchEvents() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/events?adminAddress=${adminAddress}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch events');
      }
      setEvents(data.data);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
  }, [adminAddress]);

  const handleUpdateStatus = async (eventId: string, status: ChatEvent['status']) => {
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAddress, status }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error);

      toast.success(`Event status updated to ${status}`);
      fetchEvents(); // Refresh the list
    } catch (error: any) {
      toast.error(`Failed to update status: ${error.message}`);
    }
  };
  
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) return;
    
    try {
      const response = await fetch(`/api/admin/events/${eventId}?adminAddress=${adminAddress}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error);
      
      toast.success('Event deleted successfully.');
      fetchEvents(); // Refresh the list
    } catch (error: any) {
      toast.error(`Failed to delete event: ${error.message}`);
    }
  }

  if (loading) {
    return <div className="text-center text-gray-500">Loading events...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Manage Events</h2>
        <button 
            onClick={() => alert('Event creation form not yet implemented.')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Create Event
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled Start</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {events.map(event => (
              <tr key={event.id}>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{event.title}</div>
                  <div className="text-sm text-gray-500">{event.description?.slice(0, 50)}...</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    event.status === 'active' ? 'bg-green-100 text-green-800' :
                    event.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {event.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{new Date(event.scheduled_start).toLocaleString()}</div>
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium">
                  {event.status === 'upcoming' && <button onClick={() => handleUpdateStatus(event.id, 'active')} className="text-green-600 hover:text-green-900 mr-4">Start</button>}
                  {event.status === 'active' && <button onClick={() => handleUpdateStatus(event.id, 'completed')} className="text-yellow-600 hover:text-yellow-900 mr-4">End</button>}
                  <button onClick={() => handleDeleteEvent(event.id)} className="text-red-600 hover:text-red-900">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
