# Admin Setup Guide

This guide walks you through the initial setup of the smart contract system for the Knead NFT-gated chat platform.

## Prerequisites

- Master admin wallet with funds on Base network
- ThirdWeb account with API credentials
- Deployed smart contracts:
  - `KneadMembership` (ERC1155) - Token IDs 0 & 1
  - `KneadContributors` (ERC1155) - Token IDs 10, 11, 12
  - `KneadRewardsV3` - $TOWNS token distribution

## Environment Variables

Ensure these are set in your `.env.local` file:

```bash
# ThirdWeb
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_client_id
THIRDWEB_SECRET_KEY=your_secret_key

# NFT Contracts
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x...              # Knead Membership (Token ID 0 & 1)
NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS=0x...  # Contributor NFT (Token ID 10/11/12)
NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS=0x...          # KneadRewardsV3

# Towns Protocol
NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=your_space_id

# Supabase (freemium timer only)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Admin
MASTER_ADMIN_WALLET=0xf27dafdd875759c4f21ddcd4b8a68e86e8e6206e
```

## Setup Steps

### 1. Fund Treasury with $TOWNS

The rewards contract needs $TOWNS tokens to distribute to participants.

```bash
# Navigate to the treasury management page
# URL: https://your-domain.com/admin?tab=treasury

# Or use the ThirdWeb dashboard:
# 1. Go to ThirdWeb dashboard
# 2. Navigate to KneadRewardsV3 contract
# 3. Call `fundTreasury(uint256 amount)` with desired amount
```

**Recommended initial funding:** 10,000 $TOWNS (10,000 * 10^18 wei)

### 2. Grant Oracle Role

The oracle role allows the backend to award $TOWNS tokens on behalf of contributors.

**Via ThirdWeb Dashboard:**

1. Go to KneadRewardsV3 contract
2. Navigate to "Write" tab
3. Call `grantRole(bytes32 role, address account)`
   - `role`: `0x...` (Oracle role hash - get from contract)
   - `account`: Your backend wallet address

**Via Script:**

```javascript
// verify-treasury-wallet.js already exists in the repo
node verify-treasury-wallet.js
```

### 3. Mint Your First Contributor NFT

Give yourself (master admin) a contributor NFT:

1. Go to `/admin` on your deployed site
2. Navigate to "Contributors" tab
3. Click "Add Contributor"
4. Enter your wallet address
5. Select role type:
   - **Appointed** (Token ID 10) - Admin-appointed contributors
   - **Invited** (Token ID 11) - Invited by other contributors
   - **Earned** (Token ID 12) - Earned through community participation
6. Click "Mint Contributor NFT"

### 4. Register Your First Participant

Participants need Token ID 0 (freemium) + Token ID 1 (Knead Monthly).

**Option A: Via Stripe Webhook**

Participants will automatically receive Token IDs 0 & 1 when they subscribe via Stripe.

**Option B: Manual Minting (for testing)**

1. Go to `/admin` → "Contributors" tab
2. Use "Mint Premium" button
3. Enter participant wallet address
4. This mints both Token ID 0 and Token ID 1

### 5. Test Token Award

Verify the reward system works:

1. Log in as a contributor (with Token ID 10/11/12)
2. Go to `/chat`
3. Send a test message as a participant
4. As contributor, click "🤍 Like (8 $TOWNS)" on the participant's message
5. Verify the participant receives $TOWNS tokens

Check participant balance:

```bash
# Via ThirdWeb dashboard or call:
KneadRewardsV3.getUserStats(participantAddress)
```

## Supabase Setup

Run the migrations to create the freemium timer table:

```bash
# If using Supabase CLI:
supabase migration up

# Or manually run the SQL files in the Supabase dashboard:
# 1. supabase/migrations/001_create_freemium_timer.sql
# 2. supabase/migrations/002_drop_old_chat_tables.sql
```

**Warning:** Migration 002 will **delete** the old chat tables (`chat_users`, `chat_messages`, etc.). Make sure all chat data has been migrated to Towns Protocol before running this migration.

## Verification Checklist

After setup, verify:

- [ ] Treasury has sufficient $TOWNS balance
- [ ] Oracle role granted to backend wallet
- [ ] Master admin has contributor NFT
- [ ] Test participant has Token IDs 0 & 1
- [ ] Token award system works
- [ ] Freemium timer table created in Supabase
- [ ] Towns Protocol space is accessible
- [ ] Contributors can set username/display name
- [ ] DMs work between contributors

## Troubleshooting

### "Insufficient funds" error when awarding tokens

- Check treasury balance: Call `KneadRewardsV3.getTreasuryBalance()`
- Fund treasury if needed: Call `KneadRewardsV3.fundTreasury(amount)`

### "Unauthorized" error on admin actions

- Verify your wallet address matches `MASTER_ADMIN_WALLET`
- Check you have contributor NFT (Token ID 10/11/12)

### Freemium timer not tracking

- Verify Supabase migrations ran successfully
- Check `freemium_chat_sessions` table exists
- Verify `get_freemium_chat_time_remaining` function exists

### Contributors can't set username

- Verify Towns Protocol space ID is correct
- Check contributor has Towns agent initialized
- Ensure wallet is connected when setting username

## Support

For issues:

1. Check contract events on Base explorer
2. Review browser console for errors
3. Check Supabase logs for database errors
4. Contact master admin: 0xf27dafdd875759c4f21ddcd4b8a68e86e8e6206e
