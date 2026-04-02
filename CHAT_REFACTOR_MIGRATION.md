# Chat System Refactoring - Migration Guide

## Overview

This refactoring replaces the Supabase points-based system with direct $TOWNS blockchain integration and implements an iMessage-inspired UI.

## Key Changes

### 1. Blockchain Integration

**Old System:**
- Points stored in Supabase `point_transactions` table
- Complex multiplier calculations in `lib/chat/calculate-points.ts`
- Weekly budgets tracked in database

**New System:**
- Direct blockchain queries for $TOWNS balances
- NFT ownership determines contributor permissions
- Wallet-to-wallet token transfers (no treasury intermediary)

### 2. API Endpoints

#### Deleted Endpoints
- `POST /api/points/award` - Point award (deprecated)
- `POST /api/chat/award-points` - Duplicate points API (deprecated)

#### New Endpoints

**`POST /api/chat/award-tokens`**
Validates token award requests before client-side execution.

```typescript
// Request
{
  contributorAddress: "0x...",
  participantAddress: "0x...",
  amount: 5.0, // $TOWNS tokens
  actionType: "substantive_comment",
  eventId: "event-123" // optional
}

// Response
{
  success: true,
  validated: true,
  contributorBalance: 50.0,
  amount: 5.0,
  message: "Validation successful. Please sign the transaction..."
}
```

**`GET /api/chat/award-tokens?contributorAddress=0x...`**
Check contributor's current award capacity.

**`POST /api/chat/withdraw`**
Validates balance for user-initiated withdrawals.

```typescript
// Request
{
  userAddress: "0x...",
  amountTowns: 10.0
}

// Response
{
  success: true,
  balance: 50.0,
  message: "Balance verified. Please sign the transaction..."
}
```

### 3. Blockchain Utilities

#### `lib/blockchain/towns-utils.ts`

**`getUserTownsBalance(walletAddress: string): Promise<number>`**
Query user's $TOWNS balance from blockchain.

```typescript
const balance = await getUserTownsBalance("0x...");
console.log(`User has ${balance} $TOWNS`);
```

**`awardTownsTokens(contributorAccount, participantAddress, amount, eventId?)`**
Award tokens directly from contributor to participant.

```typescript
const receipt = await awardTownsTokens(
  contributorAccount,
  "0xparticipant...",
  5.0,
  "event-123"
);
console.log(`Transaction: ${receipt.transactionHash}`);
```

#### `lib/blockchain/contributor-nft.ts`

**`isContributor(address: string): Promise<boolean>`**
Check if user has contributor NFT.

```typescript
const hasNFT = await isContributor("0x...");
if (hasNFT) {
  console.log("User is a contributor");
}
```

**`getContributorType(address): Promise<'appointed' | 'earned' | 'invited' | null>`**
Get contributor role from NFT metadata.

```typescript
const type = await getContributorType("0x...");
// Returns: 'appointed', 'earned', 'invited', or null
```

### 4. UI Components

#### `ChatLayout` Component

Provides iMessage-style layout with:
- Animated expandable logo header
- Swipe gestures (right = menu, left = DMs)
- Clean, minimal design

```tsx
import { ChatLayout } from '@/components/chat/ChatLayout';

<ChatLayout>
  {/* Your chat content */}
</ChatLayout>
```

#### `MessageBubble` Component

iMessage-style message bubbles:

```tsx
import { MessageBubble } from '@/components/chat/MessageBubble';

<MessageBubble
  message={{
    id: "msg-1",
    content: "Hello world!",
    sender: { id: "user-1", name: "Alice" },
    timestamp: Date.now(),
    townsAwarded: 5.0 // Optional: shows award badge
  }}
  isOwn={true} // Blue bubble if true, gray if false
/>
```

#### `EventBanner` Component

Shows live event indicators:

```tsx
import { EventBanner } from '@/components/chat/MessageBubble';

<EventBanner
  eventTitle="Design Discussion"
  timeRemaining="15 minutes until participant window closes"
  isLive={true}
/>
```

### 5. Analytics Logging

**`lib/analytics/transaction-logger.ts`**

Logs blockchain transactions for analytics (NOT source of truth).

```typescript
import { logTransactionAnalytics } from '@/lib/analytics/transaction-logger';

await logTransactionAnalytics({
  from: "0xcontributor...",
  to: "0xparticipant...",
  amount: 5.0,
  txHash: "0x...",
  eventId: "event-123",
  timestamp: Date.now()
});
```

## Environment Variables

Add to `.env.local`:

```bash
# Existing variables (unchanged)
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_client_id
THIRDWEB_SECRET_KEY=your_secret_key

# $TOWNS Token Contract
NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS=0x...

# Contributor NFT Contract
NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS=0x...

# Optional: Test mode toggle
NEXT_PUBLIC_TEST_ENVIRONMENT=true
```

## Migration Checklist

### For Developers

- [x] Install new dependencies (`framer-motion`, `react-swipeable`)
- [x] Set environment variables
- [x] Update API calls from `/api/chat/award-points` to `/api/chat/award-tokens`
- [x] Replace `awardLike()` with `recordLike()` for UI-only likes
- [x] Use `getUserTownsBalance()` instead of Supabase points queries
- [x] Enable private key export in wallet config

### For Infrastructure

- [ ] Deploy $TOWNS token contract to Base
- [ ] Deploy Contributor NFT contract to Base
- [ ] Mint contributor NFTs to authorized wallets
- [ ] Create `transaction_logs` table in Supabase for analytics
- [ ] Set up blockchain event listeners (optional)

### For Testing

- [ ] Test token transfers on Base Sepolia testnet
- [ ] Verify NFT permission checks
- [ ] Test wallet private key export
- [ ] Validate mobile swipe gestures
- [ ] Check event banner display during live events

## Database Schema Changes

### Deprecated Tables (Keep for historical reference)
- `point_transactions` - No longer written to
- `participants.total_points` - Use blockchain balance instead
- `contributors.remaining_weekly_budget` - Use wallet balance

### New Tables (Optional)
```sql
-- Analytics-only transaction logs
CREATE TABLE transaction_logs (
  id SERIAL PRIMARY KEY,
  tx_hash TEXT UNIQUE NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount_towns DECIMAL(18, 8) NOT NULL,
  event_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Breaking Changes

1. **Points no longer awarded via API**
   - Old: `POST /api/chat/award-points`
   - New: Client-side token transfer with wallet signature

2. **Contributor status via NFT, not database**
   - Old: `chat_users.role = 'contributor'`
   - New: `isContributor(address)` checks NFT ownership

3. **Withdrawals require wallet signature**
   - Old: Treasury sends tokens automatically
   - New: User signs transaction from their wallet

## Backward Compatibility

- Historical points data remains in database
- Old API endpoints return `410 Gone` status
- Gradual migration from `/chat` to `/chat`

## Support

For questions or issues:
- Check TypeScript types in `lib/blockchain/*.ts`
- Review API endpoint responses in browser DevTools
- Test on Base Sepolia before mainnet deployment

---

**Migration completed:** January 2026  
**Next.js version:** 14.2.15  
**ThirdWeb SDK:** 5.57.0
