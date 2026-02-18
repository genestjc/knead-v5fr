'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar as CalendarIcon, Clock, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useActiveAccount } from 'thirdweb/react';
import { getContract, prepareContractCall } from 'thirdweb';
import { sendTransaction } from 'thirdweb';
import { client, activeChain } from '@/thirdweb-client';
import { toast } from 'sonner';

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
  host?: {
    displayName: string;
    alias: string | null;
  };
  guestAddresses?: string[];
}

interface EventsCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EventsCalendarModal({ isOpen, onClose }: EventsCalendarModalProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvpingEventId, setRsvpingEventId] = useState<string | null>(null);
  const account = useActiveAccount();

  useEffect(() => {
    if (isOpen) {
      fetchEvents();
    }
  }, [isOpen]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/events');
      const data = await response.json();
      
      if (data.success) {
        setEvents(data.data || []);
      } else {
        toast.error('Failed to load events');
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async (eventId: string) => {
    if (!account) {
      toast.error('Please connect your wallet to RSVP');
      return;
    }

    try {
      setRsvpingEventId(eventId);
      
      // Get the rewards contract
      const contractAddress = '0xde1338F826055A6311D3BBEf292dcb92dFe03CdE';
      const contract = getContract({
        client,
        address: contractAddress,
        chain: activeChain,
      });

      // Prepare the RSVP transaction
      const transaction = prepareContractCall({
        contract,
        method: 'function rsvpToEvent(uint256 eventId)',
        params: [BigInt(eventId)],
      });

      // Send the transaction
      const result = await sendTransaction({
        transaction,
        account,
      });

      toast.success('RSVP successful! See you at the event 🎉');
    } catch (error: any) {
      console.error('RSVP error:', error);
      
      // Handle specific error cases
      if (error.message?.includes('Already RSVP')) {
        toast.error('You have already RSVP\'d to this event');
      } else if (error.message?.includes('Event not found')) {
        toast.error('Event not found on-chain');
      } else {
        toast.error('Failed to RSVP. Please try again.');
      }
    } finally {
      setRsvpingEventId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-800',
      live: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const isUpcoming = (event: Event) => {
    return event.status === 'scheduled' || event.status === 'live';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-6 h-6 text-gray-700" />
                <h2 className="text-2xl font-adonis">Events Calendar</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="font-georgia-pro text-gray-500">No events scheduled at the moment</p>
                  <p className="font-georgia-pro text-sm text-gray-400 mt-2">Check back soon for upcoming events!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {events.map((event) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border border-gray-200 rounded-2xl p-5 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-xl font-adonis text-gray-900 mb-1">
                            {event.title}
                          </h3>
                          {getStatusBadge(event.status)}
                        </div>
                        
                        {isUpcoming(event) && (
                          <button
                            onClick={() => handleRSVP(event.id)}
                            disabled={rsvpingEventId === event.id}
                            className="ml-4 px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-georgia-pro text-sm"
                          >
                            {rsvpingEventId === event.id ? 'RSVPing...' : 'RSVP'}
                          </button>
                        )}
                      </div>

                      {event.description && (
                        <p className="font-georgia-pro text-gray-700 mb-4 leading-relaxed">
                          {event.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm font-georgia-pro text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            {format(new Date(event.scheduledStart), 'MMM d, yyyy')} at{' '}
                            {format(new Date(event.scheduledStart), 'h:mm a')}
                          </span>
                        </div>
                        
                        {event.videoEnabled && event.dailyRoomUrl && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>Video event</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
