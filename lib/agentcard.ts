import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const CLI = process.env.AGENTCARD_CLI_PATH || 'agentcard';
const EXEC_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_CARD_USD = 100;
const DEFAULT_MAX_USDC_TRANSFER = 100;

export interface CardDetails {
  pan: string;
  cvv: string;
  expiry: string;
  billingZip: string;
}

export interface UsdcTransferResult {
  txHash: string;
  amount: string;
  to: string;
}

function extract(stdout: string, ...keys: string[]): string {
  const lines = stdout.split('\n');
  for (const key of keys) {
    const line = lines.find(l => l.toLowerCase().startsWith(key.toLowerCase()));
    if (line) return line.split(':').slice(1).join(':').trim();
  }
  return '';
}

function run(args: string[], timeoutMs = EXEC_TIMEOUT_MS): Promise<string> {
  return execFileAsync(CLI, args, { timeout: timeoutMs }).then(({ stdout }) => stdout);
}

function readPositiveLimit(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function assertPositiveAmount(amount: number, label: string): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
}

export async function requestCard(amountUsd: number): Promise<CardDetails> {
  assertPositiveAmount(amountUsd, 'Card amount');
  const maxAmount = readPositiveLimit('AGENTCARD_MAX_CARD_USD', DEFAULT_MAX_CARD_USD);
  if (amountUsd > maxAmount) {
    throw new Error(`Card amount exceeds the configured $${maxAmount.toFixed(2)} limit`);
  }

  const stdout = await run(['request', 'new', '--amount', amountUsd.toFixed(2)]);
  const card: CardDetails = {
    pan: extract(stdout, 'PAN', 'Card Number', 'Number', 'Card'),
    cvv: extract(stdout, 'CVV', 'CVC', 'Security Code'),
    expiry: extract(stdout, 'Expiry', 'Exp', 'Expiration'),
    billingZip: extract(stdout, 'Billing ZIP', 'ZIP', 'Postal', 'Billing Zip'),
  };
  if (!card.pan) throw new Error(`AgentCard did not return a PAN.\nRaw output:\n${stdout}`);
  return card;
}

export async function sendUsdc(to: string, amountUsdc: number): Promise<UsdcTransferResult> {
  assertPositiveAmount(amountUsdc, 'USDC amount');
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
    throw new Error('Recipient must be a valid EVM address');
  }
  const maxAmount = readPositiveLimit('AGENTCARD_MAX_USDC_TRANSFER', DEFAULT_MAX_USDC_TRANSFER);
  if (amountUsdc > maxAmount) {
    throw new Error(`USDC transfer exceeds the configured ${maxAmount.toFixed(6)} USDC limit`);
  }

  const stdout = await run(['wallet', 'send', '--to', to, '--amount', amountUsdc.toFixed(6)], 90_000);
  const txMatch = stdout.match(/0x[a-fA-F0-9]{64}/);
  return { txHash: txMatch ? txMatch[0] : '', amount: amountUsdc.toFixed(6), to };
}

export async function handle3ds(): Promise<string> {
  return run(['3ds'], 120_000);
}
