// Option setters per tool. The UI contract: options are native controls with these visible labels.
//   selects:  "Output format", "Format", "Aspect ratio", "Bitrate (kbps)"
//   radios:   presets "Small" / "Balanced" / "High quality"; trim modes "Exact" / "Fast, no quality loss";
//             resize modes "Crop" / "Fit with padding" / "Fit with blur"
//   inputs:   "Start", "End" (accept "mm:ss.mmm" or seconds), "Target size (MB)", "Frame rate (fps)", "Width (px)",
//             "Fade in (s)", "Fade out (s)", and per removed section "Remove from" / "Remove to" (button "Add section")
import type { Page } from '@playwright/test';

export async function selectByLabel(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).selectOption({ label: option });
}

export async function fill(page: Page, label: string, value: string | number) {
  await page.getByLabel(label, { exact: true }).fill(String(value));
}

export async function radio(page: Page, name: string) {
  await page.getByRole('radio', { name, exact: true }).check();
}

export async function setRange(page: Page, start: number, end: number) {
  await fill(page, 'Start', start);
  await fill(page, 'End', end);
}

export async function addRemovedSections(page: Page, sections: Array<[number, number]>) {
  for (let i = 0; i < sections.length; i++) {
    await page.getByRole('button', { name: 'Add section' }).click();
    await page.getByLabel('Remove from', { exact: true }).nth(i).fill(String(sections[i][0]));
    await page.getByLabel('Remove to', { exact: true }).nth(i).fill(String(sections[i][1]));
  }
}
