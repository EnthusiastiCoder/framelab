// U25 manifest: public/manifest.webmanifest (JSON). name, start_url "/", display "standalone", theme colours,
// icons of 192x192 and 512x512 plus one with purpose "maskable"; every icon file exists under public/.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC = fileURLToPath(new URL('../../public/', import.meta.url));
const MANIFEST = `${PUBLIC}manifest.webmanifest`;

interface Icon {
  src: string;
  sizes?: string;
  type?: string;
  purpose?: string;
}

function manifest(): Record<string, unknown> & { icons?: Icon[] } {
  expect(existsSync(MANIFEST), 'public/manifest.webmanifest must exist').toBe(true);
  return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

const sizes = (i: Icon) => (i.sizes ?? '').split(/\s+/);
const purposes = (i: Icon) => (i.purpose ?? 'any').split(/\s+/);

describe('U25 manifest', () => {
  it('has name, short_name, start_url "/" and display "standalone"', () => {
    const m = manifest();
    expect(m.name).toBe('Framelab');
    expect(String(m.short_name ?? '')).not.toBe('');
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
  });

  it('has theme and background colours', () => {
    const m = manifest();
    expect(String(m.theme_color ?? '')).toMatch(/^#[0-9a-f]{3,8}$/i);
    expect(String(m.background_color ?? '')).toMatch(/^#[0-9a-f]{3,8}$/i);
  });

  it('has a 192x192 and a 512x512 icon', () => {
    const icons = manifest().icons ?? [];
    expect(icons.some((i) => sizes(i).includes('192x192') && purposes(i).includes('any'))).toBe(true);
    expect(icons.some((i) => sizes(i).includes('512x512') && purposes(i).includes('any'))).toBe(true);
  });

  it('has a maskable icon of at least 192x192', () => {
    const icons = manifest().icons ?? [];
    const maskable = icons.filter((i) => purposes(i).includes('maskable'));
    expect(maskable.length).toBeGreaterThan(0);
    expect(maskable.some((i) => sizes(i).some((s) => Number(s.split('x')[0]) >= 192))).toBe(true);
  });

  it('every icon file exists under public/ and is same-origin', () => {
    for (const icon of manifest().icons ?? []) {
      expect(icon.src, 'icons must be same-origin paths').toMatch(/^\/(?!\/)/);
      expect(existsSync(PUBLIC + icon.src.replace(/^\//, '')), `public${icon.src}`).toBe(true);
    }
  });
});
