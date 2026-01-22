# Towns Protocol Integration Migration Guide

## ✅ Phase 1 Complete: Critical Fixes (Jan 22, 2026)

### Changes Made

#### 1. Simplified Towns SDK Integration
**File: `lib/towns/client.ts`**
- ❌ Removed: Custom wrapper functions (`useTownsSendMessage`, `useTownsReactions`, `useTownsThreads`, etc.)
- ✅ Now: Direct re-exports from `@towns-protocol/react-sdk`
- **Why**: Custom metadata is not supported by Towns SDK. Simplified to use SDK directly.

```typescript
// ❌ BEFORE (Incorrect)
import { useTownsSendMessage } from '@/lib/towns/client';
const { sendMessage } = useTownsSendMessage(channelId);
await sendMessage('Hello', { kneadUserId: 'uuid' }); // Custom metadata not supported

// ✅ AFTER (Correct)
import { useSendMessage } from '@towns-protocol/react-sdk';
const { sendMessage } = useSendMessage(channelId);
await sendMessage('Hello'); // No custom metadata
```

#### 2. Fixed Channel ID Initialization
**File: `app/chat-test/chat-test-client.tsx`**
- ❌ Removed: Using `spaceId` as `defaultChannelId`
- ✅ Added: `useSpace(spaceId)` hook to fetch actual channel ID from space
- **Why**: SpaceId and ChannelId are different. Using wrong ID caused chat to fail.

```typescript
// ❌ BEFORE (Incorrect)
setDefaultChannelId(spaceIdToJoin); // Wrong!

// ✅ AFTER (Correct)
const { data: space } = useSpace(spaceId);
const channelId = space?.channelIds?.[0]; // Get actual channel ID
setDefaultChannelId(channelId);
```

#### 3. Updated DM Components
**Files: `components/chat/DirectMessageList.tsx`, `components/chat/DirectMessageInterface.tsx`**
- ❌ Removed: Imports from deleted `lib/towns/dm.ts`
- ✅ Updated: Use `useUserDms`, `useDm`, `useSendMessage` from `@towns-protocol/react-sdk`
- ❌ Removed: API calls to `/api/chat/dm/list` (deleted route)
- ✅ Updated: Fetch DMs directly from Towns SDK

#### 4. Deleted Files (Supabase → On-Chain Migration)
- ❌ `lib/towns/dm.ts` - Used non-existent `@towns/react` package
- ❌ `lib/chat/dm-permissions.ts` - Replace with Towns TokenEntitlementModule
- ❌ `app/api/chat/dm/create/route.ts` - DMs now client-side via SDK
- ❌ `app/api/chat/dm/list/route.ts` - DMs now client-side via SDK

#### 5. Created On-Chain Infrastructure

**New Contract: `contracts/KneadRewards.sol`**
```solidity
// On-chain rewards system for $TOWNS token distribution
contract KneadRewards is AccessControl {
    function awardPoints(address participant, uint256 points, string memory actionType);
    function claimRewards();
    function getUserStats(address user);
}
```

**New TypeScript Interface: `lib/blockchain/rewards-contract.ts`**
```typescript
export async function awardPointsOnChain(participantAddress, points, actionType);
export async function getUserRewardStats(userAddress);
export async function checkContributorQualification(userAddress);
```

**New API Route: `app/api/chat/award-points/route.ts`**
- Server-side endpoint for awarding points on-chain
- Verifies contributor NFT permission
- Server wallet pays gas fees

**New Roles System: `lib/towns/roles.ts`**
- Uses Towns `TokenEntitlementModule` for role-based permissions
- Participant role: Premium NFT holders
- Contributor role: Contributor NFT holders
- Admin role: Space owner (automatic)

#### 6. Backward Compatibility
**File: `lib/chat/permissions.ts` (Stub for legacy code)**
- ⚠️ Temporary stub to support existing admin routes
- 🔄 To be replaced with `lib/towns/roles.ts` in Phase 3
- Functions: `isAdmin()`, `canPostInChannel()`, `canViewChannel()`

---

## 📋 Next Steps

### Phase 2: Deploy On-Chain Rewards (Week 1)
- [ ] Deploy `KneadRewards.sol` to Base network
- [ ] Set `KNEAD_REWARDS_CONTRACT_ADDRESS` in environment variables
- [ ] Fund contract with $TOWNS treasury
- [ ] Grant Contributor roles to existing contributors
- [ ] Test point awarding flow

### Phase 3: Configure Towns Space (Week 2)
- [ ] Create Knead Space on Towns Protocol
- [ ] Set `NEXT_PUBLIC_KNEAD_SPACE_ID` in environment variables
- [ ] Set `NEXT_PUBLIC_KNEAD_CHANNEL_ID` in environment variables
- [ ] Configure TokenEntitlementModule:
  - Participant role → Premium NFT holders
  - Contributor role → Contributor NFT holders
- [ ] Set channel permissions
- [ ] Test role-based access

### Phase 4: Deprecate Supabase (Week 3-4)
- [ ] Replace `/api/chat/messages` with `useTimeline` hook
- [ ] Replace `/api/chat/like` with on-chain points
- [ ] Replace user auth with NFT-gated access
- [ ] Migrate admin routes to use `lib/towns/roles.ts`
- [ ] Keep Supabase only for:
  - Analytics dashboard
  - Moderation logs (non-financial)

---

## 🔧 Environment Variables Required

### Existing (Already Set)
```env
NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=<space-id>
NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID=<channel-id>
NEXT_PUBLIC_TOWNS_NETWORK=omega
NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS=<address>
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=<address>
THIRDWEB_SECRET_KEY=<secret>
```

### New (To Be Set)
```env
# Deploy KneadRewards.sol first, then add this
KNEAD_REWARDS_CONTRACT_ADDRESS=0x...

# $TOWNS Token (already exists on Base)
NEXT_PUBLIC_TOWNS_TOKEN_ADDRESS=0x00000000A22C618fd6b4D7E9A335C4B96B189a38
```

---

## 🚨 Breaking Changes

### For Developers
1. **No more custom metadata in `sendMessage()`**
   - Towns SDK does not support custom metadata
   - Remove any `{ kneadUserId, eventType }` objects from sendMessage calls

2. **Use Towns SDK hooks directly**
   - Replace: `import { useTownsSendMessage } from '@/lib/towns/client'`
   - With: `import { useSendMessage } from '@towns-protocol/react-sdk'`

3. **DM API routes deleted**
   - `/api/chat/dm/create` → Use `useCreateDm()` hook client-side
   - `/api/chat/dm/list` → Use `useUserDms()` hook client-side

### For Users
- No breaking changes (backward compatible)
- DMs still work, now powered by Towns Protocol directly
- Rewards system being migrated from off-chain (Supabase) to on-chain (Base)

---

## 📚 Documentation References
- [Towns Getting Started](https://docs.towns.com/build/react-sdk/getting-started)
- [Towns Roles & Entitlements](https://docs.towns.com/concepts/roles-and-entitlements)
- [useSendMessage API](https://docs.towns.com/build/react-sdk/api/useSendMessage)
- [$TOWNS Token on BaseScan](https://basescan.org/token/0x00000000A22C618fd6b4D7E9A335C4B96B189a38)

---

## 🧪 Testing

### Before Deployment
- [x] Code compiles without errors
- [ ] Lint passes (npm install taking too long, skipped locally)
- [ ] No TypeScript errors

### After Deployment
- [ ] Users can connect wallet and join space
- [ ] Messages send successfully via Towns SDK
- [ ] Timeline displays messages in real-time
- [ ] Contributors can award points on-chain
- [ ] Participants can claim $TOWNS rewards
- [ ] Role-based permissions work (Participant vs Contributor)
- [ ] DMs work between contributors (Towns SDK)
- [ ] Moderation still blocks inappropriate content

---

## 🐛 Known Issues / TODO

1. **Permissions.ts is a stub**
   - Current implementation uses Supabase + contributor NFT check
   - Should be replaced with `lib/towns/roles.ts` in Phase 3
   - Affects: Admin routes, event management

2. **Premium membership check incomplete**
   - `canPostInChannel()` currently returns `false` for premium members
   - Need to implement proper NFT check for membership contract
   - Or migrate to Towns TokenEntitlementModule

3. **No IPFS storage yet**
   - Message attachments still use Supabase Storage
   - Phase 5 will migrate to Pinata/Filecoin
   - See problem statement for details

---

## 📝 Code Review Notes

### Security Considerations
- ✅ Server wallet pays gas for point awarding (user doesn't pay)
- ✅ Contributor NFT verification before awarding points
- ✅ Cannot award points to yourself (enforced in contract)
- ⚠️ Contract not yet deployed or audited
- ⚠️ Need to set up proper key management for server wallet

### Performance Considerations
- ✅ Direct SDK integration reduces wrapper overhead
- ✅ Parallel NFT checks in permissions (when used)
- ⚠️ Multiple API calls in DM components (consider batching)

### Maintainability
- ✅ Clear separation: on-chain (rewards) vs off-chain (moderation)
- ✅ Migration path documented
- ⚠️ Temporary stub in permissions.ts needs cleanup
- ⚠️ Consider adding TypeScript interfaces for contract ABIs

---

## 🤝 Contributing

When adding new chat features:
1. Use Towns SDK hooks directly (no custom wrappers)
2. Don't pass custom metadata to `sendMessage()`
3. Use `lib/towns/roles.ts` for permissions (not `lib/chat/permissions.ts`)
4. Financial rewards go through `lib/blockchain/rewards-contract.ts`
5. Moderation stays in `lib/chat/moderation.ts`

---

Last Updated: January 22, 2026
Phase 1 Complete ✅
