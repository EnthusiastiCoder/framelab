// U6 headers: public/_headers
// Decision 3 (WS0): Whisper models are self-hosted, so the app makes zero third-party requests and
// connect-src is same-origin only (no Hugging Face hosts).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseHeadersFile, parseCsp } from '../helpers/headers';

const HEADERS = fileURLToPath(new URL('../../public/_headers', import.meta.url));

function rootRule(): Record<string, string> {
  expect(existsSync(HEADERS), 'public/_headers must exist').toBe(true);
  const rules = parseHeadersFile(readFileSync(HEADERS, 'utf8'));
  const root = rules.get('/*');
  expect(root, 'a /* rule must exist').toBeDefined();
  return root!;
}

describe('U6 _headers', () => {
  it('sets COOP same-origin and COEP require-corp on /*', () => {
    const root = rootRule();
    expect(root['cross-origin-opener-policy']).toBe('same-origin');
    expect(root['cross-origin-embedder-policy']).toBe('require-corp');
  });

  it('has a CSP without unsafe-eval and without unsafe-inline in script-src', () => {
    const root = rootRule();
    const csp = root['content-security-policy'];
    expect(csp).toBeTruthy();
    expect(csp).not.toContain("'unsafe-eval'");
    const d = parseCsp(csp);
    expect(d['script-src']).toBeDefined();
    expect(d['script-src']).not.toContain("'unsafe-inline'");
    expect(d['default-src']).toEqual(["'self'"]);
    expect(d['object-src']).toEqual(["'none'"]);
    expect(d['frame-ancestors']).toEqual(["'none'"]);
  });

  it("connect-src is exactly 'self' (models are same-origin, no third-party hosts)", () => {
    const d = parseCsp(rootRule()['content-security-policy']);
    expect(d['connect-src']).toEqual(["'self'"]);
  });

  it('names no third-party host anywhere in the CSP', () => {
    const csp = rootRule()['content-security-policy'];
    expect(csp).not.toMatch(/https?:\/\//);
    expect(csp.toLowerCase()).not.toContain('huggingface');
    expect(csp.toLowerCase()).not.toContain('jsdelivr');
  });

  it('sets the remaining hardening headers', () => {
    const root = rootRule();
    expect(root['referrer-policy']).toBe('no-referrer');
    expect(root['x-content-type-options']).toBe('nosniff');
    expect(root['permissions-policy']).toContain('camera=()');
  });
});
