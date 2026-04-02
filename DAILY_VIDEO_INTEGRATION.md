# Daily.co Video Integration Implementation Summary

## Overview
This PR implements Daily.co video integration into the `/chat` page, moving live events from the separate `/events/[id]` page into the main chat interface with a responsive split-screen layout.

## Changes Made

### 1. Created Supabase Migration
**File:** `supabase/migrations/003_chat_events_table.sql`
- Creates `chat_events` table with columns for event metadata
- Includes Daily.co room tracking (`daily_room_name`, `daily_room_url`)
- Auto-updates `updated_at` timestamp on changes
- Indexes for efficient querying by status, scheduled time, and host

### 2. Created Daily.co API Routes

#### `app/api/events/create-daily-room/route.ts`
- POST endpoint to programmatically create Daily.co rooms
- Generates unique room names: `event-{eventId}-{timestamp}`
- Configures room properties:
  - 50 max participants
  - Screenshare enabled
  - Chat disabled (using Towns Protocol)
  - Cloud recording enabled
  - 24-hour expiration
- Returns `roomUrl` and `roomName`

#### `app/api/events/generate-token/route.ts`
- POST endpoint to generate meeting tokens for participants
- Role-based permissions:
  - **Host:** `is_owner: true`, screenshare enabled, video on by default
  - **Others:** `is_owner: false`, screenshare disabled, video off by default
- 4-hour token expiration
- Returns JWT token for Daily.co authentication

#### `app/api/events/delete-daily-room/route.ts`
- DELETE endpoint to cleanup Daily.co rooms
- Called when events end or are deleted
- Gracefully handles missing rooms

### 3. Created Daily.co React Components

#### `components/chat/DailyProvider.tsx`
- Wrapper component providing Daily.co context
- Uses `@daily-co/daily-react` SDK
- Enables Daily hooks in child components

#### `components/chat/DailyVideoTile.tsx`
- Individual video/audio tile for participants
- Features:
  - Video and audio rendering
  - Camera/microphone toggle controls (for local user)
  - Visual indicators (muted, video off, speaking)
  - Placeholder when video is off
  - Responsive sizing
- Props: `sessionId`, `label`, `isLocal`

#### `components/chat/EventVideoStage.tsx`
- Container managing the entire video call
- Features:
  - Creates Daily call object on mount
  - Joins room with token authentication
  - Side-by-side layout (desktop): Host left, Guest right
  - Mobile layout: Stacked vertically
  - Participant count display
  - "Leave Call" button (viewers)
  - "End Event" button (host only)
  - Error handling and loading states
- Props: `event`, `currentUserAddress`, `roomUrl`, `token`

### 4. Updated Chat Interface

#### `app/chat/connected-chat.tsx`
**Major Changes:**
- Added event polling (every 30 seconds) to detect live events
- Generates Daily.co tokens automatically when event is live
- Implements split-screen layout:
  
  **Desktop/Tablet:**
  ```
  ┌─────────────────────────────────────┐
  │  Video Stage (Host + Guest)         │  ← Top 50%
  ├─────────────────────────────────────┤
  │  Chat Messages                      │  ← Bottom 50%
  └─────────────────────────────────────┘
  ```
  
  **Mobile:**
  ```
  ┌─────────────────┐
  │  Video Stage    │  ← Top 33%
  ├─────────────────┤
  │  Chat Messages  │  ← Bottom 67%
  └─────────────────┘
  ```

- Falls back to normal full-screen chat when no event is live
- Wrapped in `DailyProvider` for Daily.co context

### 5. Updated Admin Panel

#### `components/admin/EventsManager.tsx`
- Removed manual Daily room URL input field
- Added informational message: "Daily.co room will be created automatically"
- Cleaner UX - admins don't need to manually create rooms

#### `app/api/admin/events/[id]/route.ts`
- PATCH endpoint now deletes Daily.co room when status changes to 'ended'
- DELETE endpoint already had Daily room cleanup (unchanged)
- Ensures proper resource cleanup

### 6. Removed Old Event Page
**Deleted:** `app/events/[id]/page.tsx`
- Events now fully integrated into `/chat`
- No more separate event pages

## Technical Flow

### Event Creation Flow
1. Admin creates event in `/admin` panel
2. Frontend calls `POST /api/events`
3. Backend calls Daily.co API to create room
4. Room URL and name saved to Supabase `chat_events` table
5. Event appears in admin dashboard with Daily.co link

### Event Join Flow
1. User visits `/chat`
2. Frontend polls `GET /api/events?status=live` every 30 seconds
3. If live event found:
   - Determine user role (host vs viewer)
   - Call `POST /api/events/generate-token` with user's wallet address
   - Receive Daily.co meeting token
4. Layout switches to split-screen
5. Daily.co video initializes with token
6. User can watch/participate in video + chat simultaneously

### Event End Flow
1. Admin clicks "End Event" in video stage or admin panel
2. Frontend calls `PATCH /api/admin/events/{id}` with `status: 'ended'`
3. Backend updates Supabase record
4. Backend calls Daily.co API to delete room
5. Users automatically kicked from call
6. Layout returns to normal chat

## Environment Variables Required

```bash
# Already exists in project
DAILY_API_KEY=your_daily_api_key_here

# Optional (defaults to knead.daily.co)
NEXT_PUBLIC_DAILY_DOMAIN=knead.daily.co
```

## Dependencies

The project already has the required Daily.co SDK packages:
- `@daily-co/daily-js@^0.66.0`
- `@daily-co/daily-react@^0.13.0`

## Security Considerations

1. **Token-based access:** All Daily.co rooms use meeting tokens (not public URLs)
2. **Role-based permissions:** Host has elevated permissions (screenshare, end meeting)
3. **Automatic cleanup:** Rooms deleted when events end to prevent lingering resources
4. **Time-limited tokens:** Meeting tokens expire after 4 hours
5. **Server-side validation:** All API calls validate admin permissions

## Responsive Design

### Desktop/Tablet (≥1024px)
- Horizontal split: Video top (50%), Chat bottom (50%)
- Side-by-side video tiles
- Full-width controls

### Mobile (<1024px)
- Vertical stack: Video top (33%), Chat bottom (67%)
- Single column video tiles
- Compact controls

## Testing Checklist

- [x] TypeScript compilation (no errors in new files)
- [x] ESLint validation (no errors in new files)
- [ ] Manual testing:
  - [ ] Create event with video enabled → Daily room created
  - [ ] Start event → Status changes to 'live'
  - [ ] Visit `/chat` → Split-screen appears
  - [ ] Join as host → Owner permissions, camera on
  - [ ] Join as viewer → Limited permissions, camera off
  - [ ] Send chat messages → Appear in bottom panel
  - [ ] Mobile view → Vertical layout works
  - [ ] End event → Daily room deleted, layout returns to normal

## Future Enhancements

1. **Participant video grid:** Show multiple viewers with video enabled
2. **Hand raising:** Allow viewers to request speaking time
3. **Screenshare detection:** Dedicated view when host shares screen
4. **Recording playback:** Link to cloud recordings after event ends
5. **Event notifications:** Notify users when events start
6. **Chat reactions:** Real-time emoji reactions during live events

## Files Changed

### Created (10 files)
- `supabase/migrations/003_chat_events_table.sql`
- `app/api/events/create-daily-room/route.ts`
- `app/api/events/generate-token/route.ts`
- `app/api/events/delete-daily-room/route.ts`
- `components/chat/DailyProvider.tsx`
- `components/chat/DailyVideoTile.tsx`
- `components/chat/EventVideoStage.tsx`

### Modified (3 files)
- `app/chat/connected-chat.tsx` (split-screen layout)
- `app/api/admin/events/[id]/route.ts` (Daily room cleanup)
- `components/admin/EventsManager.tsx` (remove manual URL input)

### Deleted (1 file)
- `app/events/[id]/page.tsx`

## Total Changes
- ~1,000 lines added
- ~460 lines removed
- Net: ~540 lines of new functionality

---

**Ready for Review:** This PR is ready for code review and manual testing in a staging environment with Daily.co credentials configured.
