import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const CLI = process.env.AGENTCARD_CLI_PATH || 'agentcard';
const EXEC_TIMEOUT_MS = 60_000;

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

export async function requestCard(amountUsd: number): Promise<CardDetails> {
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
  const stdout = await run(['wallet', 'send', '--to', to, '--amount', amountUsdc.toFixed(6)], 90_000);
  const txMatch = stdout.match(/0x[a-fA-F0-9]{64}/);
  return { txHash: txMatch ? txMatch[0] : '', amount: amountUsdc.toFixed(6), to };
}

export async function handle3ds(): Promise<string> {
  return run(['3ds'], 120_000);
}
