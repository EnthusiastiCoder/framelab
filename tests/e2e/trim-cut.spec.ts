// E12 trim exact: 1.0 to 3.0 s gives 2.0 +- 1 frame (0.034 s).
// E13 trim fast: duration >= 2.0 s and <= 2.0 s + 1 GOP (1 s); the UI shows the keyframe note.
//   (Fast uses 1.5 to 3.5 s so the start is NOT on a keyframe and the snap is actually exercised.)
// E14 cut: removing 1 to 2 s from 5 s gives 4.0 +- 0.07 s, audio within 0.05 s of video.
import { test, expect } from '@playwright/test';
import { FIXTURES } from '../helpers/fixtures';
import { loadFile, openTool, runAndDownload } from '../helpers/app';
import { addRemovedSections, radio, setRange } from '../helpers/ops';
import { probe } from '../helpers/probe';

test.describe('trim and cut', () => {
  test('E12 exact trim 1.0-3.0 s is 2.0 s within one frame', async ({ page }, info) => {
    await openTool(page, 'trim-video');
    await loadFile(page, FIXTURES.h264);
    await radio(page, 'Exact');
    await setRange(page, 1, 3);
    const p = await probe(await runAndDownload(page, info.outputPath('out')));
    expect(Math.abs(p.duration - 2)).toBeLessThanOrEqual(0.034);
    expect(p.width).toBe(640);
  });

  test('E13 fast trim snaps to the previous keyframe and says so', async ({ page }, info) => {
    await openTool(page, 'trim-video');
    await loadFile(page, FIXTURES.h264);
    await radio(page, 'Fast, no quality loss');
    await expect(page.getByTestId('keyframe-note')).toBeVisible();
    await expect(page.getByTestId('keyframe-note')).toContainText(/keyframe/i);
    await setRange(page, 1.5, 3.5);
    const p = await probe(await runAndDownload(page, info.outputPath('out')));
    expect(p.duration).toBeGreaterThanOrEqual(2.0 - 0.001);
    expect(p.duration).toBeLessThanOrEqual(3.0 + 0.001);
  });

  test('E14 cutting 1-2 s out of 5 s leaves 4.0 s with audio in sync', async ({ page }, info) => {
    await openTool(page, 'cut-video');
    await loadFile(page, FIXTURES.h264);
    await addRemovedSections(page, [[1, 2]]);
    const p = await probe(await runAndDownload(page, info.outputPath('out')));
    expect(Math.abs(p.duration - 4)).toBeLessThanOrEqual(0.07);
    expect(p.audioTracks).toBe(1);
    expect(Math.abs(p.audioDuration! - p.videoDuration!)).toBeLessThanOrEqual(0.05);
  });

  test('E14 cutting two sections removes both', async ({ page }, info) => {
    await openTool(page, 'cut-video');
    await loadFile(page, FIXTURES.h264);
    await addRemovedSections(page, [[1, 2], [3, 3.5]]);
    const p = await probe(await runAndDownload(page, info.outputPath('out')));
    expect(Math.abs(p.duration - 3.5)).toBeLessThanOrEqual(0.07);
  });
});
