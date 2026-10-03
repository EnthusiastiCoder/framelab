// E38: the "?" key opens the keyboard shortcuts sheet (role dialog, name matching /keyboard shortcuts/i);
// Tab and Shift+Tab keep focus inside it; Esc closes it and focus returns to the element focused before.
// Typing "?" in a text field does not open it.
import { test, expect, type Page } from '@playwright/test';

const sheet = (page: Page) => page.getByRole('dialog', { name: /keyboard shortcuts/i });

const focusInsideSheet = (page: Page) =>
  page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));

test('E38 "?" opens the shortcut sheet, focus is trapped, Esc closes it and restores focus', async ({ page }) => {
  const res = await page.goto('/compress-video');
  expect(res?.status()).toBe(200);
  const opener = page.getByRole('link').first();
  await opener.focus();
  await page.evaluate(() => document.activeElement?.setAttribute('data-e38-opener', ''));

  await page.keyboard.press('Shift+Slash');
  await expect(sheet(page)).toBeVisible();
  expect(await focusInsideSheet(page)).toBe(true);

  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await focusInsideSheet(page), `after Tab ${i + 1}`).toBe(true);
  }
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await focusInsideSheet(page), `after Shift+Tab ${i + 1}`).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-e38-opener') ?? false)).toBe(true);
});

test('E38 typing "?" in a text field does not open the shortcut sheet', async ({ page }) => {
  await page.goto('/compress-video');
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'e38-field';
    input.setAttribute('aria-label', 'E38 field');
    document.querySelector('main')!.prepend(input);
  });
  await page.locator('#e38-field').focus();
  await page.keyboard.press('Shift+Slash');
  await expect(page.locator('#e38-field')).toHaveValue('?');
  await expect(sheet(page)).toBeHidden();
  // The sheet does exist: the same key outside a field opens it.
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('Shift+Slash');
  await expect(sheet(page)).toBeVisible();
});
