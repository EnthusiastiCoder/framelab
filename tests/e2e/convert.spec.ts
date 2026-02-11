// E11 convert: webm->mp4 gives H.264/AAC MP4 (+-0.1 s); mov->mp4 likewise; mp4->webm gives VP9/Opus.
// E20 @cross (chromium): convert to MP4 on bundled Chromium either succeeds through ffmpeg or offers WebM,
// with the reason shown (test id "engine-reason").
import { test, expect } from '@playwright/test';
import { basename } from 'node:path';
import { FIXTURES } from '../helpers/fixtures';
import { engineChip, loadFile, openTool, runAndDownload } from '../helpers/app';
import { selectByLabel } from '../helpers/ops';
import { probe } from '../helpers/probe';

test.describe('convert video', () => {
  test('E11 webm -> mp4 gives H.264/AAC', async ({ page }, info) => {
    await openTool(page, 'convert-video');
    await loadFile(page, FIXTURES.vp9);
    await selectByLabel(page, 'Output format', 'MP4');
    const out = await runAndDownload(page, info.outputPath('out'));
    expect(basename(out)).toMatch(/\.mp4$/);
    const p = await probe(out);
    expect(p.videoCodec).toBe('avc');
    expect(p.audioCodec).toBe('aac');
    expect(Math.abs(p.duration - 5)).toBeLessThanOrEqual(0.1);
  });

  test('E11 mov -> mp4 gives H.264/AAC', async ({ page }, info) => {
    await openTool(page, 'mov-to-mp4');
    await loadFile(page, FIXTURES.mov);
    const p = await probe(await runAndDownload(page, info.outputPath('out')));
    expect(p.mimeType).toContain('video/mp4');
    expect(p.videoCodec).toBe('avc');
    expect(p.audioCodec).toBe('aac');
    expect(Math.abs(p.duration - 3)).toBeLessThanOrEqual(0.1);
  });

  test('E11 mp4 -> webm gives VP9/Opus', async ({ page }, info) => {
    await openTool(page, 'mp4-to-webm');
    await loadFile(page, FIXTURES.h264);
    const out = await runAndDownload(page, info.outputPath('out'));
    expect(basename(out)).toMatch(/\.webm$/);
    const p = await probe(out);
    expect(p.videoCodec).toBe('vp9');
    expect(p.audioCodec).toBe('opus');
    expect(Math.abs(p.duration - 5)).toBeLessThanOrEqual(0.1);
  });

  test('E11 variant pages preselect the output format', async ({ page }) => {
    await openTool(page, 'webm-to-mp4');
    await expect(page.getByLabel('Output format', { exact: true })).toHaveValue(/mp4/i);
    await openTool(page, 'mp4-to-webm');
    await expect(page.getByLabel('Output format', { exact: true })).toHaveValue(/webm/i);
  });

  test('E20 MP4 on bundled Chromium succeeds via ffmpeg or offers WebM with a reason @cross', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'bundled Chromium only (H.264/AAC encoder may or may not exist)');
    await openTool(page, 'convert-video');
    await loadFile(page, FIXTURES.vp9);
    await selectByLabel(page, 'Output format', 'MP4');
    const chip = await engineChip(page);
    const reason = page.getByTestId('engine-reason');
    if (chip.includes('Fast')) {
      // The browser can encode H.264/AAC: a real conversion must succeed and verify.
      const p = await probe(await runAndDownload(page, info.outputPath('out')));
      expect(p.mimeType).toContain('video/mp4');
      expect(p.videoCodec).toBe('avc');
      expect(p.audioCodec).toBe('aac');
      expect(Math.abs(p.duration - 5)).toBeLessThanOrEqual(0.1);
    } else if (chip.includes('Compatibility')) {
      await expect(reason).toBeVisible();
      expect((await reason.innerText()).trim().length).toBeGreaterThan(5);
      const p = await probe(await runAndDownload(page, info.outputPath('out')));
      expect(p.mimeType).toContain('video/mp4');
      expect(Math.abs(p.duration - 5)).toBeLessThanOrEqual(0.1);
    } else {
      await expect(reason).toBeVisible();
      expect((await reason.innerText()).trim().length).toBeGreaterThan(5);
      await expect(reason).toContainText('WebM');
    }
  });
});
