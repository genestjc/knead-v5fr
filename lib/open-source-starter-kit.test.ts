/**
 * The export blocklist is a security boundary, and its previous failure was
 * silent: an entry read "lib/thirdweb-server-wallet.ts" while the file lived
 * at the repo root, so it matched nothing and the file was exportable for as
 * long as that entry existed. Nothing failed, nothing logged. These tests name
 * real paths in this repository so a moved file breaks a test instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isExportBlockedPath, isSecretEnvFile } from './open-source-starter-kit';

test('blocks privileged files by basename wherever they sit', () => {
  // The regression: this file is at the repo root, not under lib/.
  assert.equal(isExportBlockedPath('thirdweb-server-wallet.ts'), true);
  assert.equal(isExportBlockedPath('lib/thirdweb-server-wallet.ts'), true);
  assert.equal(isExportBlockedPath('vercel.json'), true);
});

test('blocks privileged runtimes and operator scripts', () => {
  assert.equal(isExportBlockedPath('server/key-sharer.ts'), true);
  assert.equal(isExportBlockedPath('server/agent-runner.ts'), true);
  assert.equal(isExportBlockedPath('scripts/manage-moderator.ts'), true);
  assert.equal(isExportBlockedPath('scripts/distribute-contributor-pool.ts'), true);
});

test('blocks admin and agent surfaces', () => {
  assert.equal(isExportBlockedPath('app/admin/page.tsx'), true);
  assert.equal(isExportBlockedPath('app/api/admin/events/route.ts'), true);
  assert.equal(isExportBlockedPath('app/api/agent/listener/route.ts'), true);
  assert.equal(isExportBlockedPath('lib/admin/whatever.ts'), true);
});

test('blocks every .env, the committed template included', () => {
  assert.equal(isExportBlockedPath('.env'), true);
  assert.equal(isExportBlockedPath('.env.local'), true);
  assert.equal(isExportBlockedPath('.env.production'), true);
  // The ZIP writes its own .env.example from a template in the route, so
  // nothing needs the repo's copy.
  assert.equal(isExportBlockedPath('.env.example'), true);
});

test('still allows the code the assistant exists to teach', () => {
  assert.equal(isExportBlockedPath('app/api/check-membership/route.ts'), false);
  assert.equal(isExportBlockedPath('components/ui/button.tsx'), false);
  assert.equal(isExportBlockedPath('lib/sanity/client.ts'), false);
  assert.equal(isExportBlockedPath('middleware.ts'), false);
  assert.equal(isExportBlockedPath('supabase/migrations/010_repo_cache.sql'), false);
});

test('isSecretEnvFile keeps its narrower meaning for generated files', () => {
  assert.equal(isSecretEnvFile('.env.local'), true);
  assert.equal(isSecretEnvFile('.env.example'), false);
  assert.equal(isSecretEnvFile('app/page.tsx'), false);
});
