// This file provides placeholder permission functions to resolve build errors
// during the transition from Supabase chat to Towns Protocol chat.
// The actual permission handling will be managed by the Towns SDK on the client side.

/**
 * Placeholder to check if a user can view a channel.
 * @returns {Promise<boolean>} Always returns true.
 */
export async function canViewChannel(userId: string, channelId: string): Promise<boolean> {
  // During migration, we assume any user can view any channel.
  // The Towns client-side SDK will handle the actual data scoping.
  return true;
};

/**
 * Placeholder to check if a user can post in a channel.
 * @returns {Promise<boolean>} Always returns true.
 */
export async function canPostInChannel(userId: string, channelId: string): Promise<boolean> {
  // During migration, we assume any user can post.
  // The Towns client-side SDK will handle the actual sending permissions.
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
    canDelete: false, // As a safe default
    canEdit: false,   // As a safe default
  };
};

// You can keep other functions if they are used elsewhere, or remove them.
// For safety, we'll keep a version of isAdmin if other parts of the app use it.
export function isAdmin(user: { role?: string }): boolean {
  return user.role === 'admin' || user.role === 'master-admin';
}
