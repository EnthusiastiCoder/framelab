// E36: "Use the result in another tool". Compress, then send the result to Video to GIF: /video-to-gif opens with
// the compressed file already loaded (loaded-file shows its name), with no upload (no non-GET request and no
// cross-origin request from the hand-off on), and the GIF tool runs on it.
// UI contract: after an export, a button named "Use the result in another tool" opens a list of tools; the
// GIF entry is a link or menu item named "Video to GIF".
import { test, expect, type Request } from '@playwright/test';
import { FIXTURES } from '../helpers/fixtures';
import { loadFile, openTool, runAndDownload } from '../helpers/app';
import { probeGif } from '../helpers/probe';

test('E36 a compressed result hands off to /video-to-gif without any upload', async ({ page, baseURL }, info) => {
  await openTool(page, 'compress-video');
  await loadFile(page, FIXTURES.h264);
  await runAndDownload(page, info.outputPath('compress'));

  const origin = new URL(baseURL!).origin;
  const uploads: string[] = [];
  const onRequest = (req: Request) => {
    const url = req.url();
    if (/^(data|blob):/.test(url)) return;
    if (req.method() !== 'GET' || new URL(url).origin !== origin) uploads.push(`${req.method()} ${url}`);
  };
  page.on('request', onRequest);

  await page.getByRole('button', { name: 'Use the result in another tool' }).click();
  await page.getByRole('link', { name: 'Video to GIF' }).or(page.getByRole('menuitem', { name: 'Video to GIF' })).click();
  await expect(page).toHaveURL(/\/video-to-gif\/?(\?.*)?$/);
  await expect(page.getByTestId('dropzone')).toBeVisible();
  await expect(page.getByTestId('loaded-file')).toContainText('-framelab');

  const gif = probeGif(await runAndDownload(page, info.outputPath('gif')));
  expect(gif.magic).toBe('GIF89a');
  expect(gif.frames).toBeGreaterThan(1);
  page.off('request', onRequest);
  expect(uploads).toEqual([]);
});
