import { createPublicClient, formatEther, http, isAddress } from 'viem';
import { base } from 'viem/chains';
import { SERVER_WALLET_ADDRESS } from '@/thirdweb-server-wallet';
import { sendEmail } from '@/lib/sendEmail';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * Low-gas alerting for the Engine server wallet.
 *
 * Every mint/burn (onboarding, premium, cancellation) spends native ETH from
 * this wallet. If it runs dry, *all* of those operations fail silently — new
 * users can't onboard and paying members don't get their NFT. This is also the
 * blast-radius cap for a gas-drain attack: even if someone forces extra mints,
 * we get told the balance is dropping instead of finding out from support
 * tickets.
 *
 * Call it fire-and-forget (`void alertIfServerWalletLow()`) from mint paths — it
 * never throws and never blocks the request.
 */

// Threshold below which we alert, in ETH. ~0.005 ETH is thousands of Base mints
// of headroom; tune via env without a redeploy.
const MIN_GAS_ETH = Number(process.env.SERVER_WALLET_MIN_GAS_ETH ?? '0.005');
const WEI_PER_ETH = 10n ** 18n;
const MIN_GAS_WEI = BigInt(Math.floor(MIN_GAS_ETH * 1e6)) * (WEI_PER_ETH / 1_000_000n);
const basePublicClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
});

export async function alertIfServerWalletLow(): Promise<void> {
  try {
    if (!SERVER_WALLET_ADDRESS || !isAddress(SERVER_WALLET_ADDRESS)) return;

    const balanceWei = await basePublicClient.getBalance({
      address: SERVER_WALLET_ADDRESS,
    });
    const displayValue = formatEther(balanceWei);
    const symbol = 'ETH';

    if (balanceWei >= MIN_GAS_WEI) return; // healthy — nothing to do

    logger.warn(
      `⚠️ Server wallet gas low: ${displayValue} ${symbol} (threshold ${MIN_GAS_ETH} ETH)`,
      { wallet: SERVER_WALLET_ADDRESS },
    );

    // Throttle to at most one alert per hour so a busy period doesn't spam the
    // inbox. With Upstash this is shared across instances; without it, it's
    // best-effort per instance.
    const { success: firstThisHour } = await rateLimit('gas-alert', 'server-wallet', {
      limit: 1,
      windowSeconds: 3600,
    });
    if (!firstThisHour) return;

    const alertTo = process.env.ADMIN_ALERT_EMAIL;
    if (!alertTo) {
      logger.warn(
        '[server-wallet-balance] ADMIN_ALERT_EMAIL not set — logged the low balance but sent no email.',
      );
      return;
    }

    await sendEmail({
      to: alertTo,
      subject: `⚠️ Knead server wallet low on gas (${displayValue} ${symbol})`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5;">
          <h2>Server wallet is low on gas</h2>
          <p>The Engine server wallet that pays for minting and burning is below the alert threshold.</p>
          <table style="border-collapse: collapse;">
            <tr><td style="padding:4px 12px 4px 0;"><strong>Balance</strong></td><td>${displayValue} ${symbol}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;"><strong>Threshold</strong></td><td>${MIN_GAS_ETH} ETH</td></tr>
            <tr><td style="padding:4px 12px 4px 0;"><strong>Wallet</strong></td><td><code>${SERVER_WALLET_ADDRESS}</code></td></tr>
            <tr><td style="padding:4px 12px 4px 0;"><strong>Network</strong></td><td>Base</td></tr>
          </table>
          <p>Top it up soon — onboarding and premium mints fail once it hits zero.</p>
          <p><a href="https://basescan.org/address/${SERVER_WALLET_ADDRESS}">View on Basescan →</a></p>
        </div>
      `,
    });

    logger.log(`[server-wallet-balance] Low-gas alert emailed to ${alertTo}`);
  } catch (err) {
    // Alerting must never break a mint. Swallow and log.
    logger.error('[server-wallet-balance] Balance check/alert failed:', err);
  }
}
