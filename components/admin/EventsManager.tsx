import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { getContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { useActiveAccount } from 'thirdweb/react';
import { client as thirdwebClient } from '@/thirdweb-client';

interface EventsManagerProps {
  adminAddress: string;
}

export function EventsManager({ adminAddress }: EventsManagerProps) {
  // ✅ MOVED: Call hook at component level
  const account = useActiveAccount();
  
  const [events, setEvents] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/events');
      const data = await response.json();
      
      if (data.success) {
        setEvents(data.events || []);
      } else {
        console.error('Failed to fetch events:', data.error);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ FIXED: Use account from component props
  const handleUpdateEventStatus = async (eventId: string, newStatus: string) => {
    if (isUpdating) {
      alert('Please wait for the current update to complete.');
      return;
    }

    // ✅ Check if account exists BEFORE doing anything
    if (!account) {
      alert('No wallet connected. Please connect your wallet.');
      return;
    }

    try {
      setIsUpdating(true);
      
      // 1. Update event status in database
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAddress, status: newStatus }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      console.log('✅ Event status updated in database');

      // 2. Update Event Pass NFTs on-chain (only for live/ended)
      if (newStatus === 'live' || newStatus === 'ended') {
        console.log('🎫 Updating Event Pass NFTs...');
        
        // ✅ FOR NOW: Manually enter participant addresses
        const participantAddressesInput = prompt(
          `Enter Participant wallet addresses (comma-separated):\n\nExample:\n0x123...,0x456...,0x789...`
        );
        
        if (!participantAddressesInput) {
          alert('No addresses entered. Event status updated but no passes minted/burned.');
          await fetchEvents();
          setIsUpdating(false);
          return;
        }
        
        const participantAddresses = participantAddressesInput
          .split(',')
          .map(addr => addr.trim())
          .filter(addr => addr.startsWith('0x'));
        
        if (participantAddresses.length === 0) {
          alert('No valid addresses found.');
          await fetchEvents();
          setIsUpdating(false);
          return;
        }

        console.log(`📋 ${participantAddresses.length} addresses provided`);

        // Get Event Pass contract
        const eventPassContract = getContract({
          client: thirdwebClient,
          chain: base,
          address: process.env.NEXT_PUBLIC_EVENT_PASS_CONTRACT!,
        });

        if (newStatus === 'live') {
          // Mint Event Passes
          console.log(`🎫 Minting passes to ${participantAddresses.length} participants...`);
          
          const transaction = prepareContractCall({
            contract: eventPassContract,
            method: "function batchMintPasses(address[] memory recipients, string memory eventId)",
            params: [participantAddresses, eventId],
          });

          alert(`⏳ Minting ${participantAddresses.length} Event Passes...\n\nPlease confirm the transaction in your wallet.`);
          
          // ✅ FIXED: Use account from component scope
          const txResult = await sendTransaction({
            transaction,
            account, // ✅ From component-level hook
          });
          
          console.log(`✅ Passes minted! Tx: ${txResult.transactionHash}`);
          alert(`✅ Event Started!\n\n${participantAddresses.length} Event Passes minted!\n\nParticipants can now message in chat.\n\nTx: ${txResult.transactionHash.slice(0, 10)}...`);
          
        } else if (newStatus === 'ended') {
          // Burn Event Passes
          console.log(`🔥 Burning passes from ${participantAddresses.length} participants...`);
          
          const transaction = prepareContractCall({
            contract: eventPassContract,
            method: "function batchBurnPasses(address[] memory holders)",
            params: [participantAddresses],
          });

          alert(`⏳ Burning ${participantAddresses.length} Event Passes...\n\nPlease confirm the transaction in your wallet.`);
          
          // ✅ FIXED: Use account from component scope
          const txResult = await sendTransaction({
            transaction,
            account, // ✅ From component-level hook
          });
          
          console.log(`✅ Passes burned! Tx: ${txResult.transactionHash}`);
          alert(`✅ Event Ended!\n\n${participantAddresses.length} Event Passes burned!\n\nParticipants can no longer message.\n\nTx: ${txResult.transactionHash.slice(0, 10)}...`);
        }
      } else {
        alert(`Event status updated to: ${newStatus}`);
      }

      // Refresh events list
      await fetchEvents();
    } catch (err: any) {
      console.error('Error updating event:', err);
      alert(`Failed to update event: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Rest of your component JSX...
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-adonis text-2xl mb-4">Events Manager</h2>
        
        {isLoading ? (
          <p className="font-georgia-pro text-gray-600">Loading events...</p>
        ) : events.length === 0 ? (
          <p className="font-georgia-pro text-gray-600">No events found.</p>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-adonis text-xl">{event.title}</h3>
                    <p className="font-georgia-pro text-sm text-gray-600">
                      {format(new Date(event.start_time), 'PPP p')}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-georgia-pro ${
                    event.status === 'live' ? 'bg-green-100 text-green-800' :
                    event.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {event.status}
                  </span>
                </div>
                
                <div className="flex gap-2 mt-4">
                  {event.status === 'upcoming' && (
                    <button
                      onClick={() => handleUpdateEventStatus(event.id, 'live')}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-green-600 text-white rounded-full text-sm font-georgia-pro hover:bg-green-700 disabled:opacity-50"
                    >
                      Start Event
                    </button>
                  )}
                  {event.status === 'live' && (
                    <button
                      onClick={() => handleUpdateEventStatus(event.id, 'ended')}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-red-600 text-white rounded-full text-sm font-georgia-pro hover:bg-red-700 disabled:opacity-50"
                    >
                      End Event
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
