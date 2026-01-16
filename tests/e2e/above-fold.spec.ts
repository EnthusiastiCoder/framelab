// E33: the drop zone is above the fold on every tool page at 1280x720 and 375x667:
// at least half of it is inside the viewport without scrolling, and its top edge is within the first screen.
import { test, expect } from '@playwright/test';
import { toolSlugs } from '../helpers/pages';

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 375, height: 667 },
];

for (const vp of VIEWPORTS) {
  test(`E33 the drop zone is above the fold on every tool page at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    for (const slug of await toolSlugs()) {
      const res = await page.goto(`/${slug}`);
      expect(res?.status(), slug).toBe(200);
      const zone = page.getByTestId('dropzone');
      await expect(zone, slug).toBeVisible();
      expect(await page.evaluate(() => window.scrollY), slug).toBe(0);
      await expect(zone, slug).toBeInViewport({ ratio: 0.5 });
      const box = await zone.boundingBox();
      expect(box, slug).not.toBeNull();
      expect(box!.y, slug).toBeGreaterThanOrEqual(0);
      expect(box!.y, slug).toBeLessThan(vp.height);
    }
  });
}
