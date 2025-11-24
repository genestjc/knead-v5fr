// This file provides placeholder permission functions to resolve build errors
// during the transition from Supabase chat to Towns Protocol chat.
// The actual permission handling will be managed by the Towns SDK on the client side.

/**
 * Placeholder to check if a user can view a channel.
 * @returns {Promise<boolean>} Always returns true.
 */
export async function canViewChannel(userId: string, channelId: string): Promise<boolean> {
  return true;
};

/**
 * Placeholder to check if a user can post in a channel.
 * @returns {Promise<boolean>} Always returns true.
 */
export async function canPostInChannel(userId: string, channelId: string): Promise<boolean> {
  return true;
};

/**
 * Placeholder to get a user's permissions.
 * @returns {Promise<object>} An object indicating full permissions.
 */
export async function getUserPermissions(userId: string, channelId: string) {
  return {
    canView: true,
    canPost: true,
    canDelete: false,
    canEdit: false,
  };
};

export function isAdmin(user: { role?: string }): boolean {
  return user.role === 'admin' || user.role === 'master-admin';
}
