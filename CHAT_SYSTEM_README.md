# Knead Gamified Chat System - Implementation Guide

## Overview
This implementation provides a complete gamified chat system with point economics, role-based permissions, and video integration for the Knead platform.

## Architecture

### Core Components

#### 1. Type System (`types/chat.ts`)
- **ChatUser**: User with dual-wallet system (distribution budget + personal earnings)
- **UserPermissions**: Complete permission object with freemium time tracking
- **ChatMessage**: Message with engagement metrics and moderation data
- **MessageLike**: Like transaction with multipliers
- **AutomaticBonus**: System-triggered bonuses
- **ChatEvent**: Scheduled events with Daily.co integration

#### 2. Configuration (`lib/chat/config.ts`)
- **Point Values Matrix**: 6 action types × 3 event types
  - Actions: timely_question, substantive_comment, insightful_response, creative_contribution, helpful_clarification, thoughtful_followup
  - Events: live (highest), discussion, essay (lowest)
- **Contributor Multipliers**: Appointed (0.8x), Invited (1.0x), Earned (1.5x)
- **Tier Multipliers**: Tier 1-4 (1.0x - 1.25x)
- **Automatic Bonuses**: guest_response (20), thread_starter (15), viral (25), attendance (10)

#### 3. Permissions (`lib/chat/permissions.ts`)
- `canViewChannel()`: Check if user can view (respects freemium limits)
- `canPostInChannel()`: Check if user can post (freemium = read-only)
- `canAwardLikes()`: Contributors only
- `canReceiveLikes()`: Paid participants and contributors only

#### 4. Moderation (`lib/chat/moderation.ts`)
- OpenAI Moderation API integration
- Fail-open design (if API down, allow message)
- Auto-flag threshold: 0.8
- Auto-reject threshold: 0.9
- Categories: hate, harassment, self-harm, sexual, violence

## API Routes

### Chat Core
1. **GET/POST `/api/chat/messages`**
   - Cursor-based pagination
   - Content moderation on POST
   - Automatic bonus triggers

2. **POST/DELETE `/api/chat/like`**
   - Award points with multipliers
   - Unlike within 5-minute window
   - Budget tracking

3. **POST `/api/chat/moderate`**
   - Standalone moderation check
   - Real-time preview

4. **POST/GET `/api/chat/typing`**
   - Typing indicators
   - Active typers (last 10 seconds)

5. **GET `/api/chat/permissions`**
   - Complete permission object
   - Budget and earnings info

### Admin & Events
6. **GET/POST `/api/admin/moderation`**
   - Flagged messages
   - Hide/unhide actions
   - Moderation logs

7. **GET/POST `/api/towns/claim`**
   - Withdrawal requests
   - Balance validation
   - Optimistic deduction

8. **GET/POST `/api/events`**
   - Event management
   - Daily.co room creation
   - Auto-configuration

## Client Components

### React Hook (`hooks/useChat.ts`)
```typescript
const { messages, permissions, loading, error, sendMessage, awardLike, fetchMore, hasMore, refetch } = useChat({
  channelId: 'general',
  userId: '...',
});
```
Features:
- Real-time Supabase subscriptions
- Optimistic updates
- Pagination support
- Auto-refresh on new messages

### Video Component (`components/chat/VideoStage.tsx`)
```typescript
<VideoStage
  roomUrl={event.dailyRoomUrl}
  userName={user.displayName}
  isHost={user.role === 'admin'}
  isGuest={isGuestSpeaker}
  onLeave={() => handleLeave()}
/>
```
Features:
- Auto-join on mount
- Role-based permissions (speakers vs. audience)
- Live indicators
- Connection status

## Environment Variables Required

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Daily.co
DAILY_API_KEY=

# OpenAI
OPENAI_API_KEY=

# Towns Protocol
NEXT_PUBLIC_TOWNS_API_KEY=
TREASURY_WALLET_ADDRESS=
NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS=
NEXT_PUBLIC_MEMBERSHIP_CONTRACT_ADDRESS=
```

## Database Requirements

The implementation assumes the following Supabase tables exist:
- `chat_users`
- `chat_messages`
- `message_likes`
- `chat_events`
- `participant_wallets`
- `contributor_daily_budgets`
- `towns_claim_requests`
- `typing_indicators`
- `moderation_logs`
- `freemium_sessions`

And the following RPC functions:
- `get_user_permissions()`
- `award_like()`
- `unlike_message()`
- `award_automatic_bonus()`
- `get_contributor_stats()`
- `get_freemium_time_used()`

## Usage Examples

### Sending a Message
```typescript
const success = await sendMessage('Hello, world!', replyToId);
```

### Awarding a Like
```typescript
const success = await awardLike(messageId, 'insightful_response', 'live');
```

### Creating an Event
```typescript
const response = await fetch('/api/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Live Interview with Chef',
    channelId: 'live-interviews',
    eventType: 'live',
    hostId: adminId,
    guestIds: [chefId],
    scheduledStart: '2024-01-15T19:00:00Z',
    scheduledEnd: '2024-01-15T20:00:00Z',
    videoEnabled: true,
    creatorId: adminId,
  }),
});
```

## Point Economics Flow

1. **Contributor awards like** → Calls `award_like()` DB function
2. **Function calculates**:
   - Base points = POINT_VALUES[action][event]
   - Contributor multiplier = CONTRIBUTOR_MULTIPLIERS[type]
   - Tier multiplier = TIER_MULTIPLIERS[tier]
   - Total = base × contributor × tier
3. **Updates wallets**:
   - Deducts from contributor's distribution budget
   - Adds to participant's personal earnings
4. **Checks triggers**:
   - Viral bonus: 20+ likes
   - Thread starter: 10+ replies
   - Guest response: Admin replies to participant

## Security Considerations

1. **Content Moderation**: All messages pre-flight checked
2. **Permission Gating**: Every action validates user role
3. **Rate Limiting**: Database-level RLS policies
4. **Budget Enforcement**: Atomic transactions via DB functions
5. **Fail-Open Design**: Don't block on external API failures

## Testing Checklist

- [ ] Freemium users can view but not post
- [ ] Premium users can post and receive likes
- [ ] Contributors can award likes within budget
- [ ] Unlike works within 5-minute window
- [ ] Automatic bonuses trigger correctly
- [ ] Content moderation flags inappropriate content
- [ ] Video rooms created successfully
- [ ] Real-time subscriptions update UI
- [ ] Pagination loads more messages
- [ ] Permissions update after actions

## Future Enhancements

1. **ThirdWeb Engine Integration**: Auto-process withdrawal requests
2. **Advanced Analytics**: Contributor performance dashboard
3. **Leaderboards**: Top contributors and participants
4. **Badges & Achievements**: Gamification rewards
5. **Message Reactions**: Beyond likes (emoji reactions)
6. **Thread Views**: Better conversation threading
7. **Search & Filters**: Find messages by content/user
8. **Export Chat History**: For contributors

## Troubleshooting

### Build Fails
- Check if all environment variables are set
- Verify Supabase connection
- Check Daily.co API key

### Messages Not Appearing
- Check Supabase real-time subscriptions
- Verify user permissions
- Check moderation scores

### Likes Not Working
- Verify contributor has budget remaining
- Check if user can receive likes
- Verify message exists and not deleted

### Video Not Loading
- Check Daily.co API key
- Verify room URL is valid
- Check browser permissions for camera/mic
