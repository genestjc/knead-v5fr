# Deployment Checklist

Complete deployment guide for the NFT-gated chat system on Vercel + Supabase + Base.

## Pre-Deployment

### 1. Environment Variables

Ensure all required environment variables are set in Vercel:

```bash
# ThirdWeb
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=          # From ThirdWeb dashboard
THIRDWEB_SECRET_KEY=                      # From ThirdWeb dashboard (secret!)

# Smart Contracts (Base Mainnet)
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=         # KneadMembership contract
NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS=  # KneadContributors contract
NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS=     # KneadRewardsV3 contract

# Towns Protocol
NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=          # Your Towns space ID

# Supabase
NEXT_PUBLIC_SUPABASE_URL=                 # From Supabase dashboard
NEXT_PUBLIC_SUPABASE_ANON_KEY=            # From Supabase dashboard
SUPABASE_SERVICE_ROLE_KEY=                # From Supabase dashboard (secret!)

# Admin
MASTER_ADMIN_WALLET=0xf27dafdd875759c4f21ddcd4b8a68e86e8e6206e

# Site
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### 2. Smart Contract Deployment

Deploy contracts to Base mainnet:

#### KneadMembership (ERC1155)

```bash
# Via ThirdWeb dashboard:
# 1. Go to Contracts → Deploy
# 2. Select "ERC1155"
# 3. Configure:
#    - Name: "Knead Membership"
#    - Symbol: "KNEAD"
#    - Token IDs: 0 (Freemium), 1 (Monthly)
# 4. Deploy to Base
# 5. Save contract address to NEXT_PUBLIC_NFT_CONTRACT_ADDRESS
```

#### KneadContributors (ERC1155)

```bash
# Via ThirdWeb dashboard:
# 1. Go to Contracts → Deploy
# 2. Select "ERC1155"
# 3. Configure:
#    - Name: "Knead Contributors"
#    - Symbol: "KCONTRIB"
#    - Token IDs: 10 (Appointed), 11 (Invited), 12 (Earned)
# 4. Deploy to Base
# 5. Save contract address to NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS
```

#### KneadRewardsV3

```bash
# Use existing contract or deploy new one
# Save contract address to NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS
```

### 3. Supabase Setup

#### Run Migrations

```bash
# Option A: Supabase CLI
supabase migration up

# Option B: Manual (Supabase Dashboard → SQL Editor)
# Run these files in order:
# 1. supabase/migrations/001_create_freemium_timer.sql
# 2. supabase/migrations/002_drop_old_chat_tables.sql
```

⚠️ **Warning:** Migration 002 will delete old chat tables. Backup data first!

#### Verify Tables

Confirm these tables exist:

- ✅ `freemium_chat_sessions` (new)
- ✅ `article_reads` (existing)
- ✅ `subscriptions` (existing)
- ✅ `users` (existing)
- ✅ `moderation_logs` (existing, optional)
- ❌ `chat_users` (should be deleted)
- ❌ `chat_messages` (should be deleted)

### 4. Towns Protocol Setup

1. Create a Towns space at [towns.com](https://towns.com)
2. Save the space ID to `NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID`
3. Configure space settings (name, description, icon)
4. Create default channels

## Deployment Steps

### 1. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Or use GitHub integration:
# 1. Connect GitHub repo to Vercel
# 2. Configure environment variables
# 3. Push to main branch
```

### 2. Post-Deployment Configuration

#### A. Fund Smart Contracts

```bash
# Fund KneadRewardsV3 treasury
# Via ThirdWeb dashboard:
# 1. Go to KneadRewardsV3 contract
# 2. Call fundTreasury(amount)
# 3. Send 10,000 $TOWNS (10000 * 10^18 wei)
```

#### B. Grant Permissions

```bash
# Grant oracle role for token awards
# Via ThirdWeb dashboard:
# 1. Go to KneadRewardsV3 contract
# 2. Call grantRole(ORACLE_ROLE, backendAddress)
```

#### C. Mint Master Admin Contributor NFT

```bash
# Via deployed admin panel:
# 1. Go to https://your-domain.com/admin
# 2. Connect master admin wallet
# 3. Navigate to "Contributors" tab
# 4. Mint Token ID 10 to yourself
```

### 3. DNS Configuration

```bash
# Add custom domain in Vercel
vercel domains add your-domain.com

# Configure DNS (at your registrar):
# Type: CNAME
# Name: @
# Value: cname.vercel-dns.com
```

### 4. SSL Certificate

Vercel automatically provisions SSL certificates. Verify:

```bash
# Check SSL at:
https://www.ssllabs.com/ssltest/analyze.html?d=your-domain.com
```

## Testing Procedures

### 1. Smoke Tests

After deployment, test these critical flows:

#### Wallet Connection

- [ ] Can connect with MetaMask
- [ ] Can connect with WalletConnect
- [ ] Can connect with embedded wallet

#### Role Detection

- [ ] Freemium user sees timer banner
- [ ] Freemium user blocked from posting
- [ ] Participant can post messages
- [ ] Contributor sees Like button

#### Chat Functionality

- [ ] Messages send successfully
- [ ] Messages appear in real-time
- [ ] Reactions work correctly
- [ ] DMs work between contributors

#### Token Awards

- [ ] Contributor can award tokens
- [ ] Participant receives tokens
- [ ] Toast notifications appear
- [ ] Transaction confirms on Base

### 2. Load Testing

```bash
# Test concurrent users
# Use a tool like Artillery or k6

# Example Artillery test:
artillery quick --count 10 --num 100 https://your-domain.com/chat
```

### 3. Security Audit

- [ ] All API routes verify NFT ownership
- [ ] Admin panel restricted to master admin
- [ ] Contributor actions require NFT
- [ ] No sensitive data in client bundle
- [ ] Environment variables not exposed

### 4. Mobile Testing

- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Test wallet connection on mobile
- [ ] Responsive design works

## Monitoring

### 1. Set Up Monitoring

#### Vercel Analytics

```bash
# Enable in Vercel dashboard:
# Settings → Analytics → Enable
```

#### Error Tracking (Optional)

```bash
# Sentry integration
npm install @sentry/nextjs

# Add to next.config.js:
# withSentryConfig(...)
```

### 2. Key Metrics to Monitor

- **Response times** - API routes should be < 500ms
- **Error rates** - Should be < 1%
- **NFT verification failures** - Check blockchain RPC issues
- **Freemium timer accuracy** - Verify Supabase function works
- **Towns Protocol connectivity** - Monitor websocket connections

### 3. Logging

```bash
# Vercel logs
vercel logs --follow

# Or use dashboard:
# Vercel → Project → Logs
```

## Rollback Procedure

If deployment fails:

### 1. Immediate Rollback

```bash
# Via Vercel dashboard:
# Deployments → Find last working deployment → Promote to Production

# Or via CLI:
vercel rollback
```

### 2. Database Rollback

```bash
# Supabase migrations can be rolled back:
supabase migration down

# Or manually restore from backup
```

### 3. Smart Contract Rollback

Smart contracts are immutable. If there's a critical bug:

1. Deploy new contract version
2. Update environment variables
3. Redeploy frontend
4. Migrate data if needed

## Common Issues

### Issue: NFT checks failing

**Symptoms:** All users shown as freemium

**Fix:**
1. Verify contract addresses in environment variables
2. Check Base RPC endpoint is responding
3. Verify ThirdWeb API key is valid

### Issue: Freemium timer not working

**Symptoms:** Timer shows null or doesn't count down

**Fix:**
1. Check Supabase connection
2. Verify migration 001 ran successfully
3. Check `get_freemium_chat_time_remaining` function exists

### Issue: Token awards fail

**Symptoms:** "Insufficient funds" error

**Fix:**
1. Check KneadRewardsV3 treasury balance
2. Fund treasury if needed
3. Verify oracle role granted

### Issue: Messages not appearing

**Symptoms:** Messages send but don't show in chat

**Fix:**
1. Check Towns Protocol space ID is correct
2. Verify Towns agent is initialized
3. Check browser console for errors

## Post-Deployment Checklist

After successful deployment:

- [ ] All environment variables verified
- [ ] Smart contracts deployed and funded
- [ ] Supabase migrations completed
- [ ] DNS configured and SSL active
- [ ] Master admin has contributor NFT
- [ ] Smoke tests passed
- [ ] Monitoring enabled
- [ ] Documentation updated
- [ ] Team notified of deployment
- [ ] Backup plan documented

## Maintenance

### Regular Tasks

**Daily:**
- Monitor error rates
- Check treasury balance

**Weekly:**
- Review moderation logs
- Check freemium timer accuracy
- Verify NFT minting working

**Monthly:**
- Review Vercel usage
- Check Supabase database size
- Audit contributor list
- Review smart contract events

### Updates

```bash
# Deploy updates
git push origin main

# Vercel auto-deploys from main branch

# For database changes:
# 1. Create new migration file
# 2. Test locally
# 3. Run on production Supabase
# 4. Deploy frontend
```

## Support Contacts

- **Smart Contracts:** ThirdWeb dashboard
- **Hosting:** Vercel support
- **Database:** Supabase support
- **Towns Protocol:** Towns Discord
- **Master Admin:** 0xf27dafdd875759c4f21ddcd4b8a68e86e8e6206e

## Backup Strategy

### What to Backup

1. **Environment variables** - Export from Vercel
2. **Supabase data** - Daily automatic backups
3. **Smart contract ABIs** - Store in git
4. **Towns space configuration** - Document settings

### Backup Locations

- Code: GitHub repository
- Environment: 1Password/secure vault
- Database: Supabase auto-backup (7 days)
- Documentation: Git repository

## Success Criteria

Deployment is successful when:

✅ Site loads at production URL
✅ Wallet connection works
✅ NFT-based roles detected correctly
✅ Chat messages send and receive
✅ Freemium timer displays and counts down
✅ Contributors can award tokens
✅ Admin panel accessible to master admin
✅ No critical errors in logs
✅ Performance metrics within targets

---

**Last Updated:** 2026-02-07
**Version:** 1.0.0
