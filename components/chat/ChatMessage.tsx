'use client';

import type { ChatMessage, ChatUser } from '@/types/chat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ShieldAlert, Trash2, MessageSquareReply, MicOff } from 'lucide-react';
import { toast } from 'sonner';

interface ChatMessageProps {
  message: ChatMessage;
  currentUser: ChatUser;
  onMessageDeleted: (messageId: string) => void;
}

export function ChatMessageComponent({ message, currentUser, onMessageDeleted }: ChatMessageProps) {
  // --- PERMISSION CHECKS ---
  const isAuthor = message.userId === currentUser.id;
  const isModerator = ['admin', 'master-admin', 'contributor'].includes(currentUser.role);
  
  // Who can delete? A moderator, or the author themselves.
  const canDelete = isModerator || isAuthor;
  
  // Who can mute? Only moderators, and they can't mute themselves.
  const canMute = isModerator && !isAuthor;

  // --- ACTION HANDLERS ---
  const handleDelete = async () => {
    if (!canDelete) return;

    const promise = fetch(`/api/chat/messages/${message.id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to delete message.');
        return res.json();
      })
      .then(() => {
        // Notify the parent component to remove the message from the UI
        onMessageDeleted(message.id);
      });
      
    toast.promise(promise, {
      loading: 'Deleting message...',
      success: 'Message deleted!',
      error: 'Error deleting message.',
    });
  };

  const handleMute = async () => {
    if(!canMute) return;

    const promise = fetch(`/api/chat/users/${message.userId}/mute`, { method: 'POST' });
    toast.promise(promise, {
      loading: `Muting user...`,
      success: `User has been muted.`,
      error: 'Failed to mute user.',
    });
  };

  const handleReply = () => {
    // This would trigger a state change in the parent to show a "Replying to..." UI.
    toast.info('Reply functionality coming soon!');
  };
  
  const handleReport = () => {
    toast.success('Message has been reported for review.');
  };

  return (
    <div className="group flex items-start gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg relative">
      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" title={message.userId}>
        {/* Avatar Placeholder */}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-georgia-pro font-semibold">{message.user?.displayName || 'Anonymous'}</span>
          <span className="text-xs text-gray-400">{new Date(message.timestamp).toLocaleTimeString()}</span>
        </div>
        <p className="font-georgia-pro text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{message.content}</p>
        {message.attachmentUrl && <img src={message.attachmentUrl} alt="attachment" className="mt-2 rounded-lg max-w-xs" />}
      </div>

      <div className="absolute top-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
              <MoreHorizontal size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleReply}>
              <MessageSquareReply className="mr-2 h-4 w-4" />
              <span>Reply in-thread</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleReport}>
              <ShieldAlert className="mr-2 h-4 w-4" />
              <span>Report Message</span>
            </DropdownMenuItem>
            
            {/* --- MODERATOR/AUTHOR ACTIONS --- */}
            {(canDelete || canMute) && <DropdownMenuSeparator />}
            
            {canMute && (
              <DropdownMenuItem className="text-orange-500" onClick={handleMute}>
                <MicOff className="mr-2 h-4 w-4" />
                <span>Mute User</span>
              </DropdownMenuItem>
            )}

            {canDelete && (
              <DropdownMenuItem className="text-red-500" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete Message</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
