// E5: corrupt.mp4 and not-media.mp4 each show an ErrorCard with a next step; no uncaught page errors.
import { test, expect } from '@playwright/test';
import { FIXTURES } from '../helpers/fixtures';
import { loadFile, openTool } from '../helpers/app';
import { recordPageErrors } from '../helpers/network';

for (const name of [FIXTURES.corrupt, FIXTURES.notMedia]) {
  test(`E5 ${name} shows an ErrorCard with a next step`, async ({ page }) => {
    const errors = recordPageErrors(page);
    await openTool(page, 'mute-video');
    await loadFile(page, name);
    const card = page.getByTestId('error-card');
    // The error may surface on load (probe) or when the job runs.
    await card.waitFor({ state: 'visible', timeout: 5_000 }).catch(async () => {
      await page.getByTestId('run').click();
    });
    await expect(card).toBeVisible();
    const next = card.getByTestId('error-next-step');
    await expect(next).toBeVisible();
    expect((await next.innerText()).trim().length).toBeGreaterThan(5);
    await expect(page.getByTestId('dropzone')).toBeVisible();
    expect(errors.map((e) => e.message)).toEqual([]);
  });
}
