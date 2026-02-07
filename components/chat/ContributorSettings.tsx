/**
 * Contributor Settings Component
 * 
 * Profile settings for contributors to set username, display name, and avatar.
 * Only accessible to contributors (Token ID 10/11/12 owners).
 */

'use client';

import React, { useState } from 'react';
import { useContributorProfile } from '@/hooks/use-contributor-profile';
import { uploadToIPFS, getIPFSGatewayUrl } from '@/lib/thirdweb/storage';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ContributorSettingsProps {
  streamId: string;
  currentUsername?: string;
  currentDisplayName?: string;
  currentAvatar?: string;
}

export function ContributorSettings({
  streamId,
  currentUsername = '',
  currentDisplayName = '',
  currentAvatar = '',
}: ContributorSettingsProps) {
  const [newUsername, setNewUsername] = useState(currentUsername);
  const [newDisplayName, setNewDisplayName] = useState(currentDisplayName);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(currentAvatar);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const { updateUsername, updateDisplayName, isUpdating } = useContributorProfile(streamId);

  // Handle username update
  async function handleUsernameUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (newUsername !== currentUsername) {
      await updateUsername(newUsername);
    }
  }

  // Handle display name update
  async function handleDisplayNameUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (newDisplayName !== currentDisplayName) {
      await updateDisplayName(newDisplayName);
    }
  }

  // Handle avatar file selection
  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setAvatarFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Upload avatar to IPFS
  async function handleAvatarUpload() {
    if (!avatarFile) {
      toast.error('Please select an image first');
      return;
    }

    setIsUploadingAvatar(true);

    try {
      console.log('Uploading avatar to IPFS...');
      const ipfsUri = await uploadToIPFS(avatarFile);
      const gatewayUrl = getIPFSGatewayUrl(ipfsUri);

      console.log('Avatar uploaded:', { ipfsUri, gatewayUrl });
      
      // TODO: Store avatar URI in user profile (Towns Protocol or separate storage)
      // For now, just show success message
      toast.success('Avatar uploaded successfully!');
      
      // Update preview to gateway URL
      setAvatarPreview(gatewayUrl);
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(`Failed to upload avatar: ${error.message}`);
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-adonis text-2xl">Contributor Profile Settings</CardTitle>
          <CardDescription className="font-georgia-pro">
            Customize your contributor profile for the Knead community
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Username Section */}
          <form onSubmit={handleUsernameUpdate} className="space-y-4">
            <div>
              <Label htmlFor="username" className="font-georgia-pro">
                Username
              </Label>
              <p className="text-sm text-gray-500 mb-2">
                Your unique identifier (3-20 characters, alphanumeric, _ or -)
              </p>
              <div className="flex gap-2">
                <Input
                  id="username"
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="cool_contributor"
                  className="flex-1 font-georgia-pro"
                  disabled={isUpdating}
                />
                <Button 
                  type="submit" 
                  disabled={isUpdating || newUsername === currentUsername}
                  className="font-georgia-pro"
                >
                  {isUpdating ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </div>
          </form>

          {/* Display Name Section */}
          <form onSubmit={handleDisplayNameUpdate} className="space-y-4">
            <div>
              <Label htmlFor="displayName" className="font-georgia-pro">
                Display Name
              </Label>
              <p className="text-sm text-gray-500 mb-2">
                Your friendly name shown in chat (max 50 characters)
              </p>
              <div className="flex gap-2">
                <Input
                  id="displayName"
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Cool Contributor"
                  className="flex-1 font-georgia-pro"
                  disabled={isUpdating}
                  maxLength={50}
                />
                <Button 
                  type="submit" 
                  disabled={isUpdating || newDisplayName === currentDisplayName}
                  className="font-georgia-pro"
                >
                  {isUpdating ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </div>
          </form>

          {/* Avatar Upload Section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="avatar" className="font-georgia-pro">
                Avatar
              </Label>
              <p className="text-sm text-gray-500 mb-2">
                Upload your profile picture (max 5MB, images only)
              </p>
              
              {/* Avatar Preview */}
              {avatarPreview && (
                <div className="mb-4">
                  <img 
                    src={avatarPreview} 
                    alt="Avatar preview" 
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="flex-1 font-georgia-pro"
                  disabled={isUploadingAvatar}
                />
                <Button 
                  type="button"
                  onClick={handleAvatarUpload}
                  disabled={!avatarFile || isUploadingAvatar}
                  className="font-georgia-pro"
                >
                  {isUploadingAvatar ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="font-adonis text-lg">Profile Preview</CardTitle>
          <CardDescription className="font-georgia-pro">
            How your profile appears in chat
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-gray-300 flex-shrink-0 overflow-hidden">
              {avatarPreview ? (
                <img 
                  src={avatarPreview} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  ?
                </div>
              )}
            </div>
            <div>
              <p className="font-georgia-pro font-semibold">
                {newDisplayName || 'Display Name'}
              </p>
              <p className="text-sm text-gray-500">
                @{newUsername || 'username'}
              </p>
            </div>
            <span className="ml-auto text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-georgia-pro">
              ⭐ Contributor
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
