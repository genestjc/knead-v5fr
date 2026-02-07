/**
 * Contributor Profile Hook
 * 
 * Manages contributor username/display name via Towns Protocol.
 * Contributors can set custom usernames and display names for chat.
 */

'use client';

import { useState } from 'react';
import { useSetUsername, useSetDisplayName } from '@towns-protocol/react-sdk';
import { toast } from 'sonner';

interface UseContributorProfileResult {
  username: string;
  displayName: string;
  updateUsername: (newUsername: string) => Promise<void>;
  updateDisplayName: (newDisplayName: string) => Promise<void>;
  isUpdating: boolean;
}

/**
 * Hook to manage contributor profile (username and display name)
 * 
 * @param streamId - Towns Protocol stream/channel ID
 * @returns Profile management functions
 */
export function useContributorProfile(streamId: string): UseContributorProfileResult {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const { setUsername: townsSetUsername } = useSetUsername(streamId);
  const { setDisplayName: townsSetDisplayName } = useSetDisplayName(streamId);

  async function updateUsername(newUsername: string): Promise<void> {
    if (!newUsername || newUsername.trim().length === 0) {
      toast.error('Username cannot be empty');
      return;
    }

    // Validate username format (alphanumeric, underscores, hyphens)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(newUsername)) {
      toast.error('Username must be 3-20 characters (letters, numbers, _ or -)');
      return;
    }

    setIsUpdating(true);

    try {
      console.log('Setting username:', newUsername);
      await townsSetUsername(newUsername.trim());
      
      setUsername(newUsername.trim());
      toast.success('Username updated successfully!');
    } catch (error: any) {
      console.error('Error setting username:', error);
      
      if (error.message?.includes('already taken')) {
        toast.error('Username already taken. Please choose another.');
      } else if (error.message?.includes('user rejected')) {
        toast.error('Update cancelled');
      } else {
        toast.error(`Failed to update username: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function updateDisplayName(newDisplayName: string): Promise<void> {
    if (!newDisplayName || newDisplayName.trim().length === 0) {
      toast.error('Display name cannot be empty');
      return;
    }

    // Validate display name length
    if (newDisplayName.trim().length > 50) {
      toast.error('Display name must be 50 characters or less');
      return;
    }

    setIsUpdating(true);

    try {
      console.log('Setting display name:', newDisplayName);
      await townsSetDisplayName(newDisplayName.trim());
      
      setDisplayName(newDisplayName.trim());
      toast.success('Display name updated successfully!');
    } catch (error: any) {
      console.error('Error setting display name:', error);
      
      if (error.message?.includes('user rejected')) {
        toast.error('Update cancelled');
      } else {
        toast.error(`Failed to update display name: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsUpdating(false);
    }
  }

  return {
    username,
    displayName,
    updateUsername,
    updateDisplayName,
    isUpdating,
  };
}
