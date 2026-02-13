'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActiveAccount } from 'thirdweb/react';
import { toast } from 'sonner';
import { useAdminRedact } from '@towns-protocol/react-sdk';

interface AdminContextMenuProps {
  message: {
    id: string;
    sender: {
      id: string;
      name: string;
    };
    content: string;
  };
  eventId?: number;
  channelId: string;
  spaceId: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export function AdminContextMenu({ 
  message, 
  eventId, 
  channelId, 
  spaceId, 
  position, 
  onClose 
}: AdminContextMenuProps) {
  const activeAccount = useActiveAccount();
  const [isProcessing, setIsProcessing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  
  const { adminRedact, isPending: isRedacting } = useAdminRedact(channelId);

  // Adjust position to prevent off-screen menu
  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let newX = position.x;
      let newY = position.y;
      
      if (newX + menuRect.width > viewportWidth - 10) {
        newX = viewportWidth - menuRect.width - 10;
      }
      
      if (newY + menuRect.height > viewportHeight - 10) {
        newY = viewportHeight - menuRect.height - 10;
      }
      
      if (newX < 10) {
        newX = 10;
      }
      
      if (newY < 10) {
        newY = 10;
      }
      
      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [position]);

  // Close on click outside
  useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [onClose]);

  // Close on touch outside
  useEffect(() => {
    const handleTouch = () => onClose();
    document.addEventListener('touchstart', handleTouch);
    return () => document.removeEventListener('touchstart', handleTouch);
  }, [onClose]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleAwardBonus = async (amount: number, bonusType: string) => {
    if (!activeAccount?.address) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('🎁 Awarding bonus:', {
        admin: activeAccount.address,
        participant: message.sender.id,
        amount,
        bonusType,
        eventId,
      });

      const response = await fetch('/api/chat/award-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAddress: activeAccount.address,
          eventId,
          participantAddress: message.sender.id,
          bonusAmount: amount,
          bonusType,
        }),
      });

      const data = await response.json();
      
      console.log('📬 API Response:', data);

      if (data.success) {
        toast.success(`Awarded ${amount} TOWNS bonus!`, {
          description: `TX: ${data.transactionHash?.slice(0, 10)}...`,
        });
        onClose();
      } else {
        console.error('❌ API Error:', data);
        toast.error(data.error || 'Failed to award bonus', {
          description: data.details,
        });
      }
    } catch (error: any) {
      console.error('❌ Catch Error:', error);
      toast.error(error.message || 'Failed to award bonus');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteMessage = async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗑️ DELETE MESSAGE - PRE-FLIGHT CHECK');
    console.log('   Message ID:', message.id);
    console.log('   Message ID type:', typeof message.id);
    console.log('   Message ID length:', message.id?.length);
    console.log('   Message ID hex check:', /^[a-f0-9]+$/.test(message.id || ''));
    console.log('   Channel ID:', channelId);
    console.log('   Space ID:', spaceId);
    console.log('   Admin address:', activeAccount?.address);
    console.log('   adminRedact available:', !!adminRedact);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ✅ Validate adminRedact function exists
    if (!adminRedact) {
      console.error('❌ adminRedact function not available');
      console.error('   This means the Towns SDK hook failed to initialize');
      toast.error('Delete function not available', {
        description: 'Try refreshing the page to reconnect to Towns Protocol',
      });
      return;
    }

    // ✅ Validate message.id
    if (!message.id || typeof message.id !== 'string') {
      console.error('❌ Invalid message ID:', message.id);
      toast.error('Invalid message ID. Cannot delete.');
      return;
    }

    // ✅ Validate it looks like a Towns event ID (64 character hex hash)
    if (message.id.length !== 64 || !/^[a-f0-9]+$/.test(message.id)) {
      console.error('⚠️ Message ID does not look like a Towns event ID');
      console.error('   Expected: 64-character hex hash');
      console.error('   Got:', message.id);
      console.error('   Length:', message.id.length);
      toast.error(`Invalid event ID format. Expected 64-char hex, got ${message.id.length} chars.`);
      return;
    }

    if (!confirm('Delete this message from Towns Protocol?')) return;

    setIsProcessing(true);
    try {
      console.log('🔄 Calling adminRedact...');
      console.log('   Event ID:', message.id);
      console.log('   Timestamp:', new Date().toISOString());
      
      const result = await adminRedact(message.id);
      
      console.log('✅ adminRedact succeeded!', result);
      toast.success('Message deleted from Towns Protocol');
      onClose();
      
    } catch (error: any) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ REDACT FAILED - FULL ERROR DETAILS:');
      console.error('   Error:', error);
      console.error('   Message:', error?.message);
      console.error('   Name:', error?.name);
      console.error('   Code:', error?.code);
      console.error('   Stack:', error?.stack);
      
      // Stringify with all properties
      try {
        console.error('   Full Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (e) {
        console.error('   (Could not stringify error)');
      }
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // ✅ Parse specific error types
      const errorMsg = error?.message?.toLowerCase() || '';
      const errorName = error?.name || '';
      const errorCode = error?.code;
      
      // ✅ ConnectError = Authentication/Network issue
      if (errorName === 'ConnectError' || errorMsg.includes('connecterror')) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('🔴 DIAGNOSIS: CONNECTION/AUTHENTICATION ERROR');
        console.error('   Error Name:', errorName);
        console.error('   Error Code:', errorCode);
        
        if (errorMsg.includes('forwarding disabled')) {
          console.error('   Root Cause: "Forwarding disabled by request header"');
          console.error('   Translation: Towns nodes rejected your authentication');
          console.error('   Likely Reason: Delegate signature expired or invalid');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          
          toast.error('🔐 Authentication Expired', {
            description: (
              <div className="space-y-1">
                <p className="font-semibold">Your Towns session has expired.</p>
                <p className="text-xs">Refresh the page to reconnect and try again.</p>
              </div>
            ),
            duration: 8000,
          });
        } else if (errorMsg.includes('unavailable') || errorCode === 14) {
          console.error('   Root Cause: Service unavailable (gRPC code 14)');
          console.error('   Translation: Towns nodes refused the connection');
          console.error('   Likely Reason: Invalid authentication credentials');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          
          toast.error('🔐 Connection Refused', {
            description: (
              <div className="space-y-1">
                <p className="font-semibold">Towns Protocol rejected your request.</p>
                <p className="text-xs">This usually means your session expired.</p>
                <p className="text-xs mt-2"><strong>Solution:</strong> Refresh the page to create a new session.</p>
              </div>
            ),
            duration: 10000,
          });
        } else {
          console.error('   Root Cause: Unknown connection error');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          
          toast.error('🌐 Connection Error', {
            description: 'Network issue communicating with Towns Protocol. Try refreshing the page.',
            duration: 6000,
          });
        }
        return;
      }
      
      // ✅ Permission errors
      if (errorMsg.includes('permission') || 
          errorMsg.includes('unauthorized') || 
          errorMsg.includes('not allowed') ||
          errorMsg.includes('forbidden')) {
        console.error('🔴 DIAGNOSIS: PERMISSION ERROR');
        console.error('   Admin does not have Redact permission on-chain');
        console.error('   Action: Check Space smart contract permissions');
        
        toast.error('❌ Permission Denied', {
          description: (
            <div className="space-y-1">
              <p className="font-semibold">You don't have permission to delete messages.</p>
              <p className="text-xs">Contact the space owner to grant you Redact permission.</p>
            </div>
          ),
          duration: 8000,
        });
        return;
      }
      
      // ✅ Message not found
      if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
        toast.error('Message not found or already deleted');
        return;
      }
      
      // ✅ Invalid event ID
      if (errorMsg.includes('invalid') || errorMsg.includes('malformed')) {
        toast.error('Invalid event ID format', {
          description: 'The message ID is not a valid Towns event hash.',
        });
        return;
      }
      
      // ✅ Generic fallback
      toast.error('Failed to delete message', {
        description: errorMsg.substring(0, 150) || 'Unknown error. Check console for details.',
        duration: 6000,
      });
      
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBanUser = async () => {
    if (!confirm(`Ban ${message.sender.name}? They will be banned from the chat.`)) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/ban-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAddress: activeAccount?.address,
          userAddress: message.sender.id,
          ban: true,
          spaceId: spaceId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`${message.sender.name} has been banned`);
        onClose();
      } else {
        toast.error(data.error || 'Failed to ban user');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to ban user');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden min-w-[220px] max-w-[90vw]"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
          <p className="text-xs font-georgia-pro text-gray-600">
            Admin Actions
          </p>
        </div>

        {/* Award Bonus Section */}
        <div className="py-1">
          <p className="px-3 py-2 text-xs font-georgia-pro text-gray-500 uppercase tracking-wide">
            Award Bonus
          </p>
          {[
            { amount: 5, label: 'Good (5 TOWNS)', type: 'good_contribution' },
            { amount: 10, label: 'Great (10 TOWNS)', type: 'great_contribution' },
            { amount: 15, label: 'Excellent (15 TOWNS)', type: 'excellent_contribution' },
            { amount: 20, label: 'Outstanding (20 TOWNS)', type: 'outstanding_contribution' },
          ].map((option) => (
            <button
              key={option.amount}
              onClick={() => handleAwardBonus(option.amount, option.type)}
              disabled={isProcessing}
              className="w-full px-3 py-3 text-left text-sm font-georgia-pro hover:bg-blue-50 active:bg-blue-100 transition disabled:opacity-50 flex items-center gap-2 touch-manipulation"
            >
              <span>🎁</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200"></div>

        {/* Moderation Section */}
        <div className="py-1">
          <button
            onClick={handleDeleteMessage}
            disabled={isProcessing || isRedacting}
            className="w-full px-3 py-3 text-left text-sm font-georgia-pro hover:bg-yellow-50 active:bg-yellow-100 transition disabled:opacity-50 flex items-center gap-2 touch-manipulation"
          >
            <span>🗑️</span>
            <span>Delete Message</span>
          </button>
          
          <button
            onClick={handleBanUser}
            disabled={isProcessing}
            className="w-full px-3 py-3 text-left text-sm font-georgia-pro hover:bg-red-50 active:bg-red-100 text-red-600 transition disabled:opacity-50 flex items-center gap-2 touch-manipulation"
          >
            <span>🚫</span>
            <span>Ban User</span>
          </button>
        </div>

        {/* Processing indicator */}
        {(isProcessing || isRedacting) && (
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
            <p className="text-xs font-georgia-pro text-gray-600 flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Processing...
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
