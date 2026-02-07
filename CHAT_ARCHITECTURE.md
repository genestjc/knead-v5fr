# Chat System Architecture

This document explains the architecture of the NFT-gated chat system built on Towns Protocol.

## Overview

The Knead chat system is a **hybrid blockchain-web2 architecture** that combines:

- **On-chain data:** Messages, reactions, profiles (via Towns Protocol)
- **NFT-based permissions:** Role detection via ERC1155 token ownership
- **Off-chain tracking:** Freemium timer (Supabase)
- **Smart contracts:** Token rewards (KneadRewardsV3)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Chat UI    │  │  Admin Panel │  │  Profile Settings│   │
│  │ (Towns SDK) │  │  (ThirdWeb)  │  │   (Towns SDK)    │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │
└─────────┼─────────────────┼──────────────────┼──────────────┘
          │                 │                  │
          ├─────────────────┴──────────────────┘
          │
   ┌──────▼──────────────────────────────────────────────┐
   │               Blockchain Layer (Base)                │
   │                                                       │
   │  ┌──────────────┐  ┌─────────────────┐              │
   │  │Towns Protocol│  │  NFT Contracts  │              │
   │  │   (Spaces)   │  │                 │              │
   │  │              │  │ - KneadMembership│              │
   │  │ • Messages   │  │   (Token 0, 1)  │              │
   │  │ • Reactions  │  │                 │              │
   │  │ • Profiles   │  │ - Contributors  │              │
   │  │ • DMs        │  │   (Token 10,11,12)│            │
   │  └──────────────┘  └─────────────────┘              │
   │                                                       │
   │  ┌─────────────────────────────────┐                 │
   │  │    KneadRewardsV3 Contract      │                 │
   │  │  • Award $TOWNS tokens          │                 │
   │  │  • Track participant progress   │                 │
   │  │  • Manage treasury              │                 │
   │  └─────────────────────────────────┘                 │
   └───────────────────────────────────────────────────────┘
          │
   ┌──────▼──────────────────────────────────────────────┐
   │            Off-Chain Database (Supabase)             │
   │                                                       │
   │  ┌──────────────────────────────┐                    │
   │  │  freemium_chat_sessions      │  (Timer tracking)  │
   │  │  article_reads               │  (Article paywall) │
   │  │  subscriptions               │  (Article paywall) │
   │  │  moderation_logs             │  (Compliance)      │
   │  └──────────────────────────────┘                    │
   └───────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Message Sending Flow

```
User types message
     ↓
Frontend checks NFT role
     ↓
Role validation:
  - Freemium: ❌ Blocked
  - Participant: ✅ Allowed (during events)
  - Contributor: ✅ Allowed (anytime)
     ↓
Message sent to Towns Protocol
     ↓
Towns stores message on-chain
     ↓
Real-time update via Towns SDK
```

### 2. Role Detection Flow

```
User connects wallet
     ↓
Frontend calls getUserRole(address)
     ↓
Check NFT ownership in parallel:
  1. Check Token ID 1 (Knead Monthly)
  2. Check Token IDs 10/11/12 (Contributor)
     ↓
Determine role:
  - Has Token 10/11/12? → Contributor
  - Has Token 1? → Participant
  - Only Token 0? → Freemium
     ↓
Apply permissions:
  - Freemium: View only (1hr/month)
  - Participant: View + Post during events
  - Contributor: All permissions + moderation
```

### 3. Token Award Flow

```
Contributor clicks "Like" on participant message
     ↓
Frontend calls useAwardOnReaction hook
     ↓
Two parallel actions:
  1. Send "❤️" reaction to Towns Protocol
  2. Call KneadRewardsV3.awardTowns()
     ↓
Smart contract:
  - Validates contributor has permission
  - Deducts from treasury
  - Awards $TOWNS to participant
  - Emits TokensAwarded event
     ↓
Toast notification shown to user
```

### 4. Freemium Timer Flow

```
Freemium user opens chat
     ↓
Frontend calls useFreemiumChatTimer hook
     ↓
Hook queries Supabase:
  get_freemium_chat_time_remaining(wallet)
     ↓
Supabase calculates:
  - Total time used this month
  - Remaining time = 3600s - used time
     ↓
Frontend:
  - Starts countdown timer
  - Shows FreemiumBanner component
  - Blocks input when time expires
     ↓
On unmount: Save session duration to Supabase
```

## NFT-Based Role System

### Token Ownership Model

| Role | Token ID 0 | Token ID 1 | Token ID 10/11/12 | Permissions |
|------|-----------|-----------|-------------------|-------------|
| **Freemium** | ✅ | ❌ | ❌ | View only (1hr/month) |
| **Participant** | ✅ | ✅ | ❌ | View + Post during events |
| **Contributor** | ✅ | ❌/✅ | ✅ | Full access + moderation |

**Key Points:**

- Users **ALWAYS** keep Token ID 0 (freemium NFT)
- Subscription cancellation burns Token ID 1 but keeps Token ID 0
- Contributor NFTs (10/11/12) grant highest permissions

### Contributor NFT Types

- **Token ID 10 (Appointed):** Admin-appointed contributors
- **Token ID 11 (Invited):** Invited by existing contributors
- **Token ID 12 (Earned):** Earned through community participation

## Towns Protocol Integration

### What Towns Stores

- **Messages:** All chat messages (on-chain)
- **Reactions:** Likes, emojis on messages
- **Profiles:** Username, display name, bio
- **DMs:** Direct messages between users
- **Channels:** Organized discussion channels

### How We Use Towns

```typescript
// Initialize agent connection
useAgentConnection()

// Get space and channels
useSpace(spaceId)

// Send messages
useSendMessage(channelId)

// Get message timeline
useTimeline(channelId)

// Set profile
useSetUsername(streamId)
useSetDisplayName(streamId)

// Send reactions
useSendReaction(streamId)
```

## Smart Contracts

### KneadMembership (ERC1155)

**Purpose:** Membership NFTs

**Token IDs:**
- `0` - Freemium (never burned)
- `1` - Knead Monthly (burned on cancellation)

**Key Functions:**
- `mint(address to, uint256 id, uint256 amount)` - Mint membership NFTs
- `burn(address from, uint256 id, uint256 amount)` - Burn membership on cancel

### KneadContributors (ERC1155)

**Purpose:** Contributor role NFTs

**Token IDs:**
- `10` - Appointed Contributor
- `11` - Invited Contributor
- `12` - Earned Contributor

**Key Functions:**
- `adminMintContributor(address to, uint256 tokenId)` - Mint contributor NFT
- `balanceOf(address account, uint256 id)` - Check NFT ownership

### KneadRewardsV3

**Purpose:** $TOWNS token distribution

**Key Functions:**
- `awardTowns(address recipient, uint256 amount, string actionType)` - Award tokens
- `getUserStats(address user)` - Get user's token stats
- `getTreasuryBalance()` - Check treasury balance
- `fundTreasury(uint256 amount)` - Add funds to treasury

## Supabase Schema

### Tables Still Used

```sql
-- Freemium timer tracking
CREATE TABLE freemium_chat_sessions (
  id UUID PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  session_start TIMESTAMP NOT NULL,
  session_end TIMESTAMP,
  duration_seconds INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Article paywall (unchanged)
CREATE TABLE article_reads (...);
CREATE TABLE subscriptions (...);
CREATE TABLE users (...);

-- Moderation logs (compliance)
CREATE TABLE moderation_logs (...);
```

### Tables Deleted

- ❌ `chat_users` (replaced by NFT ownership)
- ❌ `chat_messages` (replaced by Towns Protocol)
- ❌ `message_likes` (replaced by Towns reactions)
- ❌ `typing_indicators` (handled client-side)

## API Routes

### NFT-Verified Routes

All these routes now verify permissions via NFT ownership:

- `/api/chat/permissions` - Get user permissions
- `/api/chat/users/[userId]/mute` - Mute users (contributors only)
- `/api/admin/moderation` - Moderation actions (contributors only)
- `/api/admin/mint-contributor` - Mint contributor NFTs (master admin only)
- `/api/admin/contributors` - List all contributors
- `/api/admin/contributors/[id]` - Revoke contributor status

### How NFT Verification Works

```typescript
// Example: Verify contributor permission
import { isContributor } from '@/lib/blockchain/check-nft-ownership';

export async function POST(req: NextRequest) {
  const { adminAddress } = await req.json();
  
  // Check NFT ownership on-chain
  const hasAdminNFT = await isContributor(adminAddress);
  
  if (!hasAdminNFT) {
    return NextResponse.json({ 
      error: 'Contributor NFT required' 
    }, { status: 403 });
  }
  
  // Continue with admin action...
}
```

## Security Considerations

### NFT-Based Security

✅ **Advantages:**
- Decentralized permission system
- Transparent role assignments
- Cannot be manipulated by database
- Auditable on-chain

⚠️ **Considerations:**
- NFT transfers change permissions instantly
- Lost wallet = lost access
- Gas costs for role changes

### Freemium Timer Security

- Timer tracked in Supabase (centralized)
- Could be exploited by clearing cookies
- Consider adding on-chain timestamp tracking for production

### Moderation

- Only contributors can moderate (NFT verified)
- Moderation actions logged for compliance
- Consider implementing on-chain ban list

## Performance Optimizations

### NFT Checks

- Results cached client-side during session
- Parallel queries for multiple NFT checks
- Fallback to "freemium" if blockchain unavailable

### Towns Protocol

- Real-time updates via websockets
- Optimistic UI updates
- Auto-retry on failed sends

## Future Enhancements

1. **On-chain ban list** - Replace Supabase moderation
2. **NFT-gated channels** - Different channels for different roles
3. **Contributor invitations** - Allow contributors to mint Token ID 11
4. **Token-weighted voting** - Governance for space decisions
5. **IPFS media storage** - Decentralized file uploads

## Support

For architecture questions, contact the master admin or review the codebase.
