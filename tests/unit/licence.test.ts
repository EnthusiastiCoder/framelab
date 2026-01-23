// L1 licence (added for decision 2, WS0; replaces the GPL-3.0-or-later default):
// - the app is "© Arpan Mandal. All Rights Reserved.": a COPYRIGHT file and a README notice, and NO LICENSE file;
// - v1 is WebCodecs-only (CTO decision): no ffmpeg build ships at all. The npm @ffmpeg/core and @ffmpeg/core-mt
//   builds bundle libx264/libx265 (GPL), so they must never be dependencies.
// - THIRD_PARTY_LICENSES.md lists the shipped dependencies, mediabunny (MPL-2.0) among them.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p: string) => {
  expect(existsSync(root(p)), `${p} must exist`).toBe(true);
  return readFileSync(root(p), 'utf8');
};

describe('L1 licence', () => {
  it('has no LICENSE file', () => {
    for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING']) {
      expect(existsSync(root(name)), `${name} must not exist`).toBe(false);
    }
  });

  it('has a COPYRIGHT file with the all-rights-reserved notice', () => {
    expect(read('COPYRIGHT')).toContain('© Arpan Mandal. All Rights Reserved.');
  });

  it('the README carries the copyright notice', () => {
    expect(read('README.md')).toContain('© Arpan Mandal. All Rights Reserved.');
  });

  it('package.json is private and UNLICENSED', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.private).toBe(true);
    expect(pkg.license).toBe('UNLICENSED');
  });

  it('does not depend on the GPL @ffmpeg/core or @ffmpeg/core-mt builds', () => {
    const pkg = JSON.parse(read('package.json'));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    expect(deps).not.toHaveProperty('@ffmpeg/core');
    expect(deps).not.toHaveProperty('@ffmpeg/core-mt');
  });

  it('has no ffmpeg dependency at all', () => {
    const pkg = JSON.parse(read('package.json'));
    const deps = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });
    expect(deps.filter((d) => /ffmpeg/i.test(d))).toEqual([]);
  });

  it('THIRD_PARTY_LICENSES.md lists mediabunny as MPL-2.0 with a source link, and no GPL-3.0-or-later', () => {
    const text = read('THIRD_PARTY_LICENSES.md');
    expect(text).toMatch(/mediabunny[^\n]*MPL-2\.0/i);
    expect(text).toMatch(/https?:\/\/\S*github\S*mediabunny/i);
    expect(text).not.toMatch(/\blibx26[45]\b[^\n]*(included|bundled|shipped)/i);
    expect(text).not.toMatch(/GPL-3\.0-or-later/);
  });
});
