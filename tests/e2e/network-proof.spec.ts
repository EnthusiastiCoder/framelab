// E39 @cross: the network proof badge says 0 on every page, and 0 cross-origin requests are recorded, with no
// exceptions (decision 3, WS0: models are self-hosted, so even a model download is same-origin).
// The badge must still say 0 after a tool flow (mute, on the path the browser supports).
import { test, expect } from '@playwright/test';
import { FIXTURES } from '../helpers/fixtures';
import { loadFile, openTool, runAndDownload } from '../helpers/app';
import { crossOriginResourceEntries, recordRequests } from '../helpers/network';
import { finishedSitePages } from '../helpers/pages';

const ZERO = /(^|\D)0 requests to other sites/;

test('E39 the network proof badge says 0 on every page and no cross-origin request is made @cross', async ({
  page,
  baseURL,
}) => {
  const net = recordRequests(page, baseURL!);
  for (const path of await finishedSitePages()) {
    const res = await page.goto(path, { waitUntil: 'networkidle' });
    expect(res?.status(), path).toBe(200);
    await expect(page.getByTestId('network-proof'), path).toContainText(ZERO);
    expect(await crossOriginResourceEntries(page), path).toEqual([]);
  }
  expect(net.crossOrigin).toEqual([]);
});

test('E39 the badge still says 0 after a mute flow @cross', async ({ page, baseURL }, info) => {
  const net = recordRequests(page, baseURL!);
  await openTool(page, 'mute-video');
  await loadFile(page, FIXTURES.vp9);
  await runAndDownload(page, info.outputPath('out'));
  await expect(page.getByTestId('network-proof')).toContainText(ZERO);
  expect(net.crossOrigin).toEqual([]);
});
