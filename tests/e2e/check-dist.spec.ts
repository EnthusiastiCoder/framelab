// E9: node scripts/check-dist.mjs exits 0 on the real build (the webServer step builds dist/ first).
import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

test('E9 check-dist passes on the real build', () => {
  expect(existsSync('dist/index.html'), 'dist/ must be built').toBe(true);
  const r = spawnSync(process.execPath, ['scripts/check-dist.mjs'], { encoding: 'utf8' });
  expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(0);
});
