# Treasury and Towns Protocol Integration Setup Guide

## Overview

This system implements automated $TOWNS token withdrawals using ThirdWeb Treasury wallet and Web3-based authentication with Towns Protocol.

## Key Features

- **Automated Withdrawals**: No manual processing - withdrawals happen instantly via smart contract
- **Web3 Authentication**: No API keys needed for Towns Protocol - uses wallet signatures
- **Treasury Monitoring**: Admin dashboard to monitor Treasury health and balances
- **Transaction Audit**: All withdrawals stored with transaction hashes for compliance

## Environment Variables Required

Add these to your `.env` or Vercel environment variables:

```bash
# ThirdWeb Configuration
THIRDWEB_SECRET_KEY=your_thirdweb_secret_key_here
THIRDWEB_PRIVATE_KEY=0x_your_treasury_wallet_private_key_here

# Towns Contract (should already be set)
NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS=0x_towns_token_contract_address_on_base
```

### How to Get These Values

1. **THIRDWEB_SECRET_KEY**: 
   - Go to [thirdweb.com](https://thirdweb.com)
   - Create an account or sign in
   - Create a new project
   - Copy the secret key from your project settings

2. **THIRDWEB_PRIVATE_KEY**:
   - Generate a new Ethereum wallet (or use an existing one)
   - Export the private key (must start with `0x`)
   - **IMPORTANT**: This wallet will hold the Treasury funds
   - Fund this wallet with:
     - $TOWNS tokens (for contributor withdrawals)
     - ETH on Base network (for gas fees)

3. **NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS**:
   - Should already be configured
   - This is the $TOWNS ERC20 token contract on Base network

## Treasury Wallet Setup

### 1. Generate Treasury Address

Once you set `THIRDWEB_PRIVATE_KEY`, you can get the Treasury address:

```typescript
import { getTreasuryAddress } from '@/lib/thirdweb/treasury';

const address = getTreasuryAddress();
console.log('Treasury Address:', address);
```

### 2. Fund the Treasury

The Treasury wallet needs two types of tokens:

1. **$TOWNS tokens**: For contributor withdrawals
2. **ETH (on Base)**: For transaction gas fees

**Minimum Recommendations**:
- $TOWNS: Total of all contributor earnings owed + buffer
- ETH: ~0.1 ETH for gas fees (check current Base gas prices)

### 3. Monitor Treasury Balance

Admins can check Treasury health at:

```
GET /api/admin/treasury?adminId={admin_user_id}
```

Response includes:
- Current Treasury balance
- Pending claims amount
- Total earnings owed to contributors
- Health status (sufficient funds?)
- Warning if underfunded

## API Endpoints

### 1. Create Withdrawal Request (Automated)

**POST** `/api/towns/claim`

Request body:
```json
{
  "userId": "uuid-of-contributor",
  "amount": 100,
  "recipientAddress": "0x_ethereum_address"
}
```

Response (success):
```json
{
  "success": true,
  "data": {
    "id": "claim-uuid",
    "userId": "user-uuid",
    "amount": 100,
    "status": "completed",
    "requestedAt": "2024-01-01T00:00:00Z",
    "processedAt": "2024-01-01T00:00:05Z",
    "txHash": "0x_transaction_hash"
  },
  "message": "Withdrawal completed successfully! 100 TOWNS sent to 0x..."
}
```

Response (failed - insufficient Treasury):
```json
{
  "success": false,
  "error": "Insufficient Treasury funds. Treasury balance: 50 TOWNS, Requested: 100 TOWNS. Please contact admin to fund the Treasury."
}
```

### 2. Get Claim History

**GET** `/api/towns/claim?userId={user_id}`

Returns array of all claim requests for a user.

### 3. Treasury Monitoring (Admin Only)

**GET** `/api/admin/treasury?adminId={admin_user_id}`

Response:
```json
{
  "success": true,
  "data": {
    "treasuryAddress": "0x_treasury_address",
    "balance": 1000.5,
    "pendingClaims": 50.0,
    "totalEarningsOwed": 850.0,
    "isHealthy": true,
    "warning": null
  }
}
```

If unhealthy:
```json
{
  "success": true,
  "data": {
    "treasuryAddress": "0x_treasury_address",
    "balance": 100.0,
    "pendingClaims": 50.0,
    "totalEarningsOwed": 850.0,
    "isHealthy": false,
    "warning": "⚠️ Treasury balance (100.00 $TOWNS) is less than owed earnings (850.00 $TOWNS). Please fund the Treasury!"
  }
}
```

## Database Schema

The system expects these database tables:

### `towns_claim_requests`

```sql
CREATE TABLE towns_claim_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  recipient_address TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  transaction_hash TEXT,
  block_number TEXT,
  processed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `participant_wallets`

```sql
CREATE TABLE participant_wallets (
  user_id UUID PRIMARY KEY,
  personal_earnings_available NUMERIC DEFAULT 0,
  personal_earnings_withdrawn NUMERIC DEFAULT 0
);
```

### `chat_users`

```sql
CREATE TABLE chat_users (
  id UUID PRIMARY KEY,
  role TEXT NOT NULL, -- 'viewer', 'contributor', 'admin', 'master-admin', 'emergency-admin'
  -- ... other fields
);
```

## Client-Side Integration (Future)

When `@towns/react` package is ready, implement Towns connection:

```typescript
import { useTownsConnection } from '@/lib/towns/client';

function MyComponent() {
  const { connect, disconnect, isConnected, agent } = useTownsConnection();
  
  // Connect with user's wallet
  const handleConnect = async () => {
    await connect();
  };
  
  return (
    <div>
      {isConnected ? (
        <button onClick={disconnect}>Disconnect</button>
      ) : (
        <button onClick={handleConnect}>Connect to Towns</button>
      )}
    </div>
  );
}
```

## Security Considerations

### 1. Private Key Security

**CRITICAL**: The `THIRDWEB_PRIVATE_KEY` controls the Treasury wallet.

- Never commit this to git
- Store securely in environment variables
- Use Vercel/hosting platform's secret management
- Rotate regularly
- Monitor wallet activity

### 2. Access Control

- Only contributors can request withdrawals
- Only admins can view Treasury dashboard
- All transactions are logged with hashes

### 3. Balance Checks

The system performs multiple balance checks:
1. User has sufficient `personal_earnings_available`
2. Treasury has sufficient $TOWNS balance
3. Both checks pass before transaction

### 4. Error Handling

If a withdrawal fails:
- Claim status set to `'failed'`
- Error message stored
- Retry count incremented
- User's balance NOT deducted
- Admin can investigate via transaction hash

## Monitoring and Maintenance

### Daily Tasks

1. **Check Treasury Balance**:
   ```bash
   curl "https://your-app.com/api/admin/treasury?adminId={admin_id}"
   ```

2. **Monitor Failed Claims**:
   - Query database for claims with `status = 'failed'`
   - Investigate error messages
   - Retry or refund as needed

### Weekly Tasks

1. **Verify Treasury Health**:
   - Ensure balance > total owed earnings
   - Top up if needed

2. **Check Gas Fees**:
   - Monitor ETH balance on Base
   - Top up if low (< 0.01 ETH)

### Emergency Procedures

If Treasury is compromised:
1. Immediately rotate `THIRDWEB_PRIVATE_KEY`
2. Generate new Treasury wallet
3. Transfer remaining funds to new wallet
4. Update environment variables
5. Notify all stakeholders

## Troubleshooting

### Withdrawal Fails with "Insufficient Treasury Funds"

**Solution**: Fund the Treasury wallet with more $TOWNS tokens.

1. Get Treasury address: `getTreasuryAddress()`
2. Send $TOWNS tokens to that address
3. Retry withdrawal

### Withdrawal Fails with Gas Error

**Solution**: Fund the Treasury wallet with ETH on Base network.

1. Get Treasury address
2. Send ~0.1 ETH (Base network) to that address
3. Retry withdrawal

### "THIRDWEB_SECRET_KEY must be set" Error

**Solution**: Add `THIRDWEB_SECRET_KEY` to environment variables.

1. Go to thirdweb.com
2. Create/find your project
3. Copy secret key
4. Add to `.env` or hosting platform

### Transaction Stuck or Slow

**Check**:
1. Base network status: [status.base.org](https://status.base.org)
2. Transaction on BaseScan: `https://basescan.org/tx/{transaction_hash}`
3. Gas price settings

## Support

For issues or questions:
1. Check transaction hash on BaseScan
2. Review error logs in hosting platform
3. Check Treasury balance
4. Verify environment variables are set correctly

## Future Enhancements

Potential improvements:
1. Automatic retry for failed withdrawals
2. Email notifications for completed/failed withdrawals
3. Gas fee optimization
4. Multi-signature Treasury wallet
5. Batch withdrawal processing
6. Real-time balance updates via WebSocket
