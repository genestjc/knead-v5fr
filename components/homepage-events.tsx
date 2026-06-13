'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  description: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  eventType: string;
  videoEnabled: boolean;
  dailyRoomUrl?: string;
  coverImageUrl?: string | null;
  host?: {
    displayName: string;
    alias: string | null;
  };
}

function EventCard({ event }: { event: Event }) {
  return (
    <div className="flex flex-col">
      <div className="relative w-full aspect-[4/3] bg-gray-100 overflow-hidden mb-4">
        {event.coverImageUrl ? (
          <>
            <img
              src={event.coverImageUrl}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <CalendarIcon className="w-12 h-12 text-gray-500" />
          </div>
        )}
        {event.status === 'live' && (
          <span className="absolute top-3 left-3 px-2 py-1 bg-green-500 text-white text-xs font-georgia-pro rounded-full">
            🔴 Live
          </span>
        )}
      </div>
      <h3 className="font-adonis text-lg text-gray-900 leading-tight mb-2">{event.title}</h3>
      <div className="flex items-center gap-1.5 text-sm font-georgia-pro text-gray-500">
        <Clock className="w-3.5 h-3.5" />
        <span>{format(new Date(event.scheduledStart), 'MMMM d, yyyy')}</span>
      </div>
      {event.host && (
        <p className="font-georgia-pro text-sm text-gray-400 mt-1">
          {event.host.alias || event.host.displayName}
        </p>
      )}
    </div>
  );
}

function EventCardSkeleton() {
  return (
    <div className="flex flex-col animate-pulse">
      <div className="w-full aspect-[4/3] bg-gray-200 mb-4" />
      <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-4 bg-gray-100 rounded w-1/2" />
    </div>
  );
}

export function HomepageEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setEvents((data.data || []).slice(0, 3));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isSingleEvent = !loading && events.length === 1;

  return (
    <section className="container-magazine pt-32 pb-24">
      <h2 className="font-adonis text-2xl text-gray-900 mb-10 text-center">Chat Events</h2>

      <div className={`grid gap-8 mb-24 ${
        isSingleEvent 
          ? 'grid-cols-1 max-w-sm mx-auto' 
          : 'grid-cols-1 md:grid-cols-3'
      }`}>
        {loading ? (
          <>
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
          </>
        ) : events.length > 0 ? (
          events.map((event) => <EventCard key={event.id} event={event} />)
        ) : (
          <div className="col-span-3 text-center py-12">
            <CalendarIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-georgia-pro text-gray-500">No upcoming events at the moment.</p>
          </div>
        )}
      </div>

      <div className="text-center mb-16">
        <Link
          href="/chat"
          className="inline-block px-8 py-4 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-georgia-pro"
        >
          Visit The Chat
        </Link>
      </div>
    </section>
  );
}
