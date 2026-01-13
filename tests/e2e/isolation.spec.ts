// E1 @cross: every page returns 200 with COOP/COEP from serve-dist; crossOriginIsolated on chromium/msedge/firefox.
// E2 @cross: on page load, 0 requests to other origins and 0 securitypolicyviolation events.
import { test, expect } from '@playwright/test';
import { allPages } from '../helpers/pages';
import { cspViolations, recordCspViolations, recordRequests } from '../helpers/network';

test.describe('isolation and third-party requests', () => {
  test('E1 every page returns 200 with COOP/COEP and the CSP @cross', async ({ request }) => {
    for (const path of await allPages()) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      const h = res.headers();
      expect(h['cross-origin-opener-policy'], path).toBe('same-origin');
      expect(h['cross-origin-embedder-policy'], path).toBe('require-corp');
      expect(h['content-security-policy'], path).toBeTruthy();
    }
  });

  test('E1 an unknown path returns the 404 page with the same headers @cross', async ({ request }) => {
    const res = await request.get('/this-page-does-not-exist');
    expect(res.status()).toBe(404);
    expect(res.headers()['cross-origin-embedder-policy']).toBe('require-corp');
  });

  test('E1 crossOriginIsolated is true on every page @cross', async ({ page }) => {
    for (const path of await allPages()) {
      await page.goto(path);
      expect(await page.evaluate(() => crossOriginIsolated), path).toBe(true);
    }
  });

  test('E2 page load makes 0 cross-origin requests and 0 CSP violations @cross', async ({ page, baseURL }) => {
    await recordCspViolations(page);
    const net = recordRequests(page, baseURL!);
    for (const path of await allPages()) {
      await page.goto(path, { waitUntil: 'networkidle' });
      expect(await cspViolations(page), `CSP violations on ${path}`).toEqual([]);
    }
    expect(net.crossOrigin).toEqual([]);
  });
});
