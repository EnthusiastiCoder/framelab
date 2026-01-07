// Network and CSP recorders for e2e tests.
import type { Page } from '@playwright/test';

export interface NetworkLog {
  all: string[];
  crossOrigin: string[];
  matching(re: RegExp): string[];
}

/** Records every request the page makes. Call before page.goto. */
export function recordRequests(page: Page, baseURL: string): NetworkLog {
  const origin = new URL(baseURL).origin;
  const all: string[] = [];
  const crossOrigin: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    all.push(url);
    if (/^(data|blob|about|chrome-extension):/.test(url)) return;
    if (new URL(url).origin !== origin) crossOrigin.push(url);
  });
  return { all, crossOrigin, matching: (re) => all.filter((u) => re.test(u)) };
}

/** Installs a listener that collects securitypolicyviolation events into window.__cspViolations. */
export async function recordCspViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __cspViolations: string[] };
    w.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
}

export async function cspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? []);
}

/** Collects uncaught page errors. Call before page.goto. */
export function recordPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));
  return errors;
}

/** Resource entries (PerformanceObserver view) whose origin differs from the page origin. */
export async function crossOriginResourceEntries(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((n) => !n.startsWith('data:') && !n.startsWith('blob:') && new URL(n).origin !== location.origin),
  );
}
