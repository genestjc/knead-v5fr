'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@supabase/auth-helpers-react'; // Or your preferred way to get the logged-in user
import { toast } from 'sonner';

interface RsvpButtonProps {
  eventId: string;
}

export function RsvpButton({ eventId }: RsvpButtonProps) {
  const user = useUser();
  const [rsvpStatus, setRsvpStatus] = useState<'loading' | 'rsvpd' | 'not_rsvpd' | 'unauthenticated'>('loading');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      setRsvpStatus('unauthenticated');
      return;
    }

    // Check the user's current RSVP status for this event
    const checkStatus = async () => {
      const res = await fetch(`/api/events/${eventId}/rsvp`);
      const data = await res.json();
      setRsvpStatus(data.rsvp_status === 'confirmed' ? 'rsvpd' : 'not_rsvpd');
    };

    checkStatus();
  }, [eventId, user]);

  const handleRsvp = async () => {
    setIsSubmitting(true);
    const res = await fetch(`/api/events/${eventId}/rsvp`, { method: 'POST' });
    const data = await res.json();

    if (res.ok) {
      toast.success('RSVP Confirmed! See you there.');
      setRsvpStatus('rsvpd');
    } else {
      toast.error(data.error || 'Failed to RSVP.');
    }
    setIsSubmitting(false);
  };

  const handleCancelRsvp = async () => {
    setIsSubmitting(true);
    const res = await fetch(`/api/events/${eventId}/rsvp`, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok) {
      toast.info('Your RSVP has been cancelled.');
      setRsvpStatus('not_rsvpd');
    } else {
      toast.error(data.error || 'Failed to cancel RSVP.');
    }
    setIsSubmitting(false);
  };

  if (rsvpStatus === 'loading') {
    return <button disabled className="px-6 py-3 bg-gray-200 text-gray-500 rounded-full font-georgia-pro cursor-wait">Loading...</button>;
  }

  if (rsvpStatus === 'unauthenticated') {
    return <button disabled className="px-6 py-3 bg-gray-200 text-gray-500 rounded-full font-georgia-pro">Connect Wallet to RSVP</button>;
  }
  
  if (rsvpStatus === 'rsvpd') {
    return (
        <button
          onClick={handleCancelRsvp}
          disabled={isSubmitting}
          className="px-6 py-3 bg-red-100 text-red-700 rounded-full font-georgia-pro hover:bg-red-200 transition disabled:opacity-50"
        >
          {isSubmitting ? 'Cancelling...' : 'Cancel RSVP'}
        </button>
    );
  }

  return (
    <button
        onClick={handleRsvp}
        disabled={isSubmitting}
        className="px-6 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition disabled:opacity-50"
    >
        {isSubmitting ? 'Confirming...' : 'RSVP to Event'}
    </button>
  );
}
