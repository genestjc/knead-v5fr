// components/chat/AdminContextMenu.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActiveAccount } from 'thirdweb/react';
import { toast } from 'sonner';
import { useAdminRedact } from '@towns-protocol/react-sdk'; // ✅ ADD THIS

interface AdminContextMenuProps {
  message: {
    id: string;
    sender: {
      id: string;
      name: string;
    };
    content: string;
  };
  eventId: number;
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
  
  // ✅ Use Towns Protocol hook for message deletion
  const { adminRedact, isPending: isRedacting } = useAdminRedact(channelId);

  // Close on click outside
  useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
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
      const response = await fetch('/api/admin/chat/award-bonus', {
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

      if (data.success) {
        toast.success(`Awarded ${amount} TOWNS bonus!`);
        onClose();
      } else {
        toast.error(data.error || 'Failed to award bonus');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to award bonus');
    } finally {
      setIsProcessing(false);
    }
  };

  // ✅ NEW: Use Towns Protocol hook to delete message
  const handleDeleteMessage = async () => {
    if (!confirm('Delete this message from Towns Protocol?')) return;

    try {
      await adminRedact({ eventId: message.id });
      toast.success('Message deleted from Towns Protocol');
      onClose();
    } catch (error: any) {
      console.error('Failed to delete message:', error);
      toast.error(error.message || 'Failed to delete message');
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden min-w-[220px]"
        style={{
          left: position.x,
          top: position.y,
        }}
        onClick={(e) => e.stopPropagation()}
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
              className="w-full px-3 py-2 text-left text-sm font-georgia-pro hover:bg-blue-50 transition disabled:opacity-50 flex items-center gap-2"
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
            className="w-full px-3 py-2 text-left text-sm font-georgia-pro hover:bg-yellow-50 transition disabled:opacity-50 flex items-center gap-2"
          >
            <span>🗑️</span>
            <span>Delete Message</span>
          </button>
          
          <button
            onClick={handleBanUser}
            disabled={isProcessing}
            className="w-full px-3 py-2 text-left text-sm font-georgia-pro hover:bg-red-50 text-red-600 transition disabled:opacity-50 flex items-center gap-2"
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
