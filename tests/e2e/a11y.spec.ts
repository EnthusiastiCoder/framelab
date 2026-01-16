// E32 @cross: axe reports 0 serious or critical violations on every page, in the light and the dark colour scheme.
// Rules: the WCAG 2.0/2.1 A and AA tags. Dark mode follows prefers-color-scheme.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { finishedSitePages } from '../helpers/pages';

for (const scheme of ['light', 'dark'] as const) {
  test(`E32 axe finds 0 serious or critical violations on every page (${scheme}) @cross`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.emulateMedia({ colorScheme: scheme });
    const failures: string[] = [];
    for (const path of await finishedSitePages()) {
      const res = await page.goto(path, { waitUntil: 'networkidle' });
      expect(res?.status(), path).toBe(200);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      for (const v of result.violations) {
        if (v.impact === 'serious' || v.impact === 'critical') {
          failures.push(`${path} [${scheme}] ${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
}
