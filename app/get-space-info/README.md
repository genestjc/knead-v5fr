# Get Space Info Utility Page

This is a **temporary utility page** to fetch the default channel ID for Towns Protocol Space ID `463997`.

## Purpose

The Knead chat system needs the channel ID to complete environment variable configuration. This page provides an easy way to:
1. Connect to Towns Protocol
2. Fetch space data for the specified space ID
3. Display and log the channel IDs
4. Output the required environment variables

## Usage

1. Navigate to `/get-space-info` in your browser
2. Connect your Web3 wallet (MetaMask or compatible)
3. Sign the message to authenticate with Towns Protocol
4. View the space information and channel IDs
5. Copy the environment variables displayed on the page

## Required Environment Variables

The page will output these variables in the correct format:

```bash
NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=463997
NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={channel_id}
```

Add these to your `.env.local` file.

## Features

- ✅ Automatic connection to Towns Protocol when wallet is connected
- ✅ Manual connection button if automatic connection fails
- ✅ Loading states for better UX
- ✅ Error handling and display
- ✅ Space metadata display (name, description)
- ✅ All channel IDs listed with default channel highlighted
- ✅ Console logging for easy copy-paste
- ✅ Clean UI with instructions

## Technical Details

- Uses `useAgentConnection` from `@towns-protocol/react-sdk` for authentication
- Uses `useSpace('463997')` hook to fetch space data
- Configured for omega environment (mainnet)
- Wrapped in TownsSyncProvider from app-level providers
- Client-side only component

## Cleanup

**This page can be deleted after obtaining the channel ID.** It's only needed for initial setup and configuration.
