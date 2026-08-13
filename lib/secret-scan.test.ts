import { test } from 'node:test';
import assert from 'node:assert/strict';

import { redactSecrets } from './secret-scan';

test('redacts vendor credentials and names what it caught', () => {
  const stripe = redactSecrets('const k = "sk_live_51H8xQ2abcdefghijklmnop";');
  assert.equal(stripe.clean.includes('sk_live_51H8xQ2'), false);
  assert.deepEqual(stripe.findings, ['stripe-key']);

  const webhook = redactSecrets('STRIPE_WEBHOOK_SECRET=whsec_AAAAAAAAAAAAAAAAAA');
  assert.equal(webhook.clean.includes('whsec_'), false);

  const jwt = redactSecrets(
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmno',
  );
  assert.deepEqual(jwt.findings, ['jwt']);

  const gh = redactSecrets('token: ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  assert.deepEqual(gh.findings, ['github-token']);

  const ai = redactSecrets('ANTHROPIC_API_KEY=sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAA');
  assert.deepEqual(ai.findings, ['ai-api-key']);

  const pem = redactSecrets('-----BEGIN RSA PRIVATE KEY-----\nMIIE...');
  assert.deepEqual(pem.findings, ['private-key-block']);
});

test('redacts a 32-byte hex value — the shape of an EVM private key', () => {
  const pk = redactSecrets('0x0000000000000000000000000000000000000000000000000000000000000001');
  assert.deepEqual(pk.findings, ['hex-private-key']);
});

test('leaves ordinary source alone', () => {
  // A 20-byte contract address is public and appears all over this repo's
  // teaching material; only 32-byte values look like keys.
  const addr = redactSecrets('address: 0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85');
  assert.deepEqual(addr.findings, []);

  const source = 'export const client = createClient({ projectId: "cs0gtnjr" });';
  const scanned = redactSecrets(source);
  assert.deepEqual(scanned.findings, []);
  assert.equal(scanned.clean, source);

  assert.deepEqual(redactSecrets('').findings, []);
});

test('catches every occurrence, and repeat calls agree', () => {
  const input = 'whsec_AAAAAAAAAAAAAAAAAA then whsec_BBBBBBBBBBBBBBBBBB';
  const first = redactSecrets(input);
  assert.equal(/whsec_[AB]/.test(first.clean), false);
  // The patterns are module-level and global; a stale lastIndex would make the
  // second call miss matches the first one caught.
  assert.equal(redactSecrets(input).clean, first.clean);
});
