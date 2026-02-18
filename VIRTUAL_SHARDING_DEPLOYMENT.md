# Virtual Sharding System - Deployment Guide

## Overview

This virtual sharding system solves the 1000-message timeline performance issue by distributing messages across 4 smaller channels based on user role and content type, then merging them into a single unified timeline for display.

## Architecture

### Channel Distribution

The system creates 4 separate channels:

1. **knead-contributors** - Text messages from contributors only
2. **knead-participants-a** - Text messages from participants (wallet address ends with 0-7)
3. **knead-participants-b** - Text messages from participants (wallet address ends with 8-f)
4. **knead-files** - All file uploads and IPFS content

This reduces messages per channel from 1000+ to ~250, improving timeline load performance by approximately 4x.

### Message Routing Logic

```typescript
if (hasFile) → knead-files
if (isContributor) → knead-contributors
if (isParticipant && address ends 0-7) → knead-participants-a
if (isParticipant && address ends 8-f) → knead-participants-b
```

### Unified Timeline

All 4 channels are subscribed to simultaneously and merged into a single chronological timeline, making the sharding completely transparent to users.

## Required Environment Variables

### Temporary (For Setup Only)

```bash
ADMIN_PRIVATE_KEY=0x...  # Your MetaMask/wallet private key
```

⚠️ **Security Notice**: This key must be kept strictly confidential. Only use it in secure Vercel environment variables. Never commit it to source control. Remove after setup is complete.

### Permanent (Required for Operation)

```bash
# The 4 channel IDs created during setup
NEXT_PUBLIC_CHANNEL_CONTRIBUTORS=...
NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A=...
NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B=...
NEXT_PUBLIC_CHANNEL_FILES=...

# Existing variables (keep these)
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=...
NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=...
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
```

## Deployment Steps

### Step 1: Add Admin Private Key to Vercel

1. Go to Vercel → Your Project → Settings → Environment Variables
2. Add `ADMIN_PRIVATE_KEY` with your wallet's private key (starts with `0x`)
3. Set environment to "Preview" only (not Production yet)
4. Click "Save"

### Step 2: Deploy PR to Preview

1. Create pull request with this code
2. Wait for Vercel to auto-deploy to preview URL
3. Note the preview URL (e.g., `https://knead-v5fr-git-feature-genestjc.vercel.app`)

### Step 3: Create the 4 Channels

**Using Admin UI (Recommended):**

1. Visit `https://your-preview-url.vercel.app/admin/setup`
2. Connect your admin wallet (the one matching ADMIN_PRIVATE_KEY)
3. Click "Create Channels" button
4. Wait for channels to be created (~30 seconds)
5. Copy all 4 channel IDs from the response

**Using API Directly (Alternative):**

```bash
curl -X POST https://your-preview-url.vercel.app/api/admin/create-channels
```

Example response:
```json
{
  "success": true,
  "channels": {
    "contributors": "0x1234...",
    "participantsA": "0x5678...",
    "participantsB": "0x9abc...",
    "files": "0xdef0..."
  }
}
```

### Step 4: Add Channel IDs to Vercel

1. Go to Vercel → Settings → Environment Variables
2. Add all 4 channel ID variables:
   - `NEXT_PUBLIC_CHANNEL_CONTRIBUTORS=<id from step 3>`
   - `NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A=<id from step 3>`
   - `NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B=<id from step 3>`
   - `NEXT_PUBLIC_CHANNEL_FILES=<id from step 3>`
3. Set to both "Preview" and "Production" environments
4. Click "Save"

### Step 5: Redeploy

1. Trigger a redeploy in Vercel (or merge the PR)
2. Wait for deployment to complete
3. Visit the app and verify chat loads correctly

### Step 6: Clean Up (Optional)

1. Remove `ADMIN_PRIVATE_KEY` from Vercel (no longer needed after setup)
2. Optionally delete `app/admin/setup` and `app/api/admin/create-channels` directories

## Testing Checklist

After deployment, verify:

- [ ] Chat loads without errors
- [ ] Timeline shows all messages from all channels merged chronologically
- [ ] Send a message as a contributor → appears in timeline
- [ ] Send a message as a participant → appears in timeline
- [ ] Upload a file → appears in timeline
- [ ] Admin can delete messages from any channel
- [ ] No console errors
- [ ] Timeline loads faster than before (check Network tab)

## Backward Compatibility

The system is designed to be backward compatible:

- If channel environment variables are not set, it falls back to the original single-channel behavior
- Existing messages in the original channel remain accessible
- No data migration required
- Can be rolled back by removing the 4 channel env vars

## Troubleshooting

### "Channels already exist" Error

The channels have already been created. Check Vercel environment variables for the existing channel IDs.

### "Missing ADMIN_PRIVATE_KEY" Error

Add the `ADMIN_PRIVATE_KEY` environment variable to Vercel with your wallet's private key.

### Messages Not Appearing

1. Check browser console for errors
2. Verify all 4 channel IDs are set correctly in Vercel
3. Verify the app was redeployed after adding channel IDs
4. Check Network tab to ensure channels are being queried

### Performance Not Improved

1. Verify virtual sharding is enabled (check console logs)
2. Check that messages are being distributed across channels
3. Ensure all 4 channels are being subscribed to
4. Clear browser cache and reload

## Technical Details

### Files Modified

**New Files:**
- `lib/role-based-channel-router.ts` - Channel routing logic
- `hooks/use-role-based-timeline.ts` - Multi-channel timeline merger
- `hooks/use-virtual-admin-redact.ts` - Cross-channel admin actions
- `app/api/admin/create-channels/route.ts` - Channel creation API
- `app/admin/setup/page.tsx` - Admin setup UI

**Updated Files:**
- `app/chat/connected-chat.tsx` - Message routing and timeline
- `components/chat/AdminContextMenu.tsx` - Virtual admin redact

### How It Works

1. **Message Sending**: When a user sends a message, the system determines the appropriate channel based on their role and content type, then uses the corresponding `useSendMessage` hook
2. **Timeline Display**: The app subscribes to all 4 channels simultaneously using separate `useTimeline` hooks, then merges and sorts the results by timestamp
3. **Admin Actions**: When an admin deletes a message, the system tries each channel sequentially until it finds and deletes the message

### Performance Impact

- **Before**: 1 channel with 1000+ messages
- **After**: 4 channels with ~250 messages each
- **Expected improvement**: ~4x faster timeline loading
- **Trade-off**: 4 WebSocket connections instead of 1 (minimal overhead)

## Support

If you encounter issues during setup:

1. Check that `ADMIN_PRIVATE_KEY` is set correctly in Vercel
2. Verify all 4 channel IDs are present as `NEXT_PUBLIC_` variables
3. Ensure Vercel redeployed after adding env vars
4. Check browser console for detailed error messages
