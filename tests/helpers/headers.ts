// Parser for the Cloudflare Pages `_headers` format, used by tests.
// Rule lines start at column 0 (a URL pattern); header lines are indented "Name: value".
// Header names are lower-cased. Lines starting with '#' are comments.

export type HeaderRules = Map<string, Record<string, string>>;

export function parseHeadersFile(text: string): HeaderRules {
  const rules: HeaderRules = new Map();
  let current: Record<string, string> | null = null;
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      current = rules.get(raw.trim()) ?? {};
      rules.set(raw.trim(), current);
      continue;
    }
    if (!current) throw new Error(`header line before any URL pattern: ${raw}`);
    const idx = raw.indexOf(':');
    if (idx < 0) throw new Error(`malformed header line: ${raw}`);
    const name = raw.slice(0, idx).trim().toLowerCase();
    const value = raw.slice(idx + 1).trim();
    current[name] = current[name] ? `${current[name]}, ${value}` : value;
  }
  return rules;
}

/** Split a CSP string into directive -> source list. */
export function parseCsp(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of csp.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const [name, ...sources] = tokens;
    out[name.toLowerCase()] = sources;
  }
  return out;
}
