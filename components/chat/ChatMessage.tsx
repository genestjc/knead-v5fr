'use client';

import type { ChatMessage, ChatUser } from '@/types/chat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

interface ChatMessageProps {
  message: ChatMessage;
  currentUser: ChatUser;
}

export function ChatMessageComponent({ message, currentUser }: ChatMessageProps) {
  // Determine user's permissions for this specific message
  const isAuthor = message.userId === currentUser.id;
  const canDelete = isAuthor || ['admin', 'master-admin', 'contributor'].includes(currentUser.role);
  const canReply = true; // Everyone can reply

  const handleDelete = async () => {
    if (!canDelete) return;

    // We need to create this API endpoint next
    // await fetch(`/api/chat/messages/${message.id}`, { method: 'DELETE' });
    toast.info('Delete functionality not yet connected.');
  };

  const handleReply = () => {
    // This would need to trigger a state change in the parent component
    // to show a "Replying to..." UI in the ChatInput
    toast.info('Reply functionality not yet connected.');
  };
  
  const handleReport = () => {
    toast.info('Report functionality not yet connected.');
  };

  return (
    <div className="group flex items-start gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg relative">
      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0">
        {/* Avatar Placeholder */}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-georgia-pro font-semibold">{message.user?.displayName || 'Anonymous'}</span>
          <span className="text-xs text-gray-400">{new Date(message.timestamp).toLocaleTimeString()}</span>
        </div>
        <p className="font-georgia-pro text-gray-800 dark:text-gray-200">{message.content}</p>
        {message.attachmentUrl && <img src={message.attachmentUrl} alt="attachment" className="mt-2 rounded-lg max-w-xs" />}
      </div>

      {/* Message Options Menu Trigger */}
      <div className="absolute top-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
              <MoreHorizontal size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canReply && <DropdownMenuItem onClick={handleReply}>Reply in-thread</DropdownMenuItem>}
            <DropdownMenuItem onClick={handleReport}>Report Message</DropdownMenuItem>
            {canDelete && <DropdownMenuSeparator />}
            {canDelete && <DropdownMenuItem className="text-red-500" onClick={handleDelete}>Delete Message</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
