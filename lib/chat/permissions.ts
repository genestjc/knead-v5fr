/**
 * Minimal permissions helper for legacy admin routes
 * Only keeps isAdmin() which is still used by contributor request APIs
 * 
 * TODO: Replace with Towns Protocol role checks when migrating contributor system
 */

/**
 * Simple helper to check for admin roles from a user object.
 * Used by: /api/admin/contributor-requests/*
 */
export function isAdmin(user: { role?: string }): boolean {
  return user?.role === 'admin' || user?.role === 'master-admin';
}

// Removed deprecated functions:
// - isLiveEventActive (unused)
// - canPostInChannel (deprecated, use Towns Protocol)
// - canViewChannel (deprecated, use Towns Protocol)
