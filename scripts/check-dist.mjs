#!/usr/bin/env node
// Checks the built site in dist/ before it ships. Fails on:
// - any file over 25 MiB (the Cloudflare Pages per-file cap);
// - any absolute http(s) URL in built HTML/JS/CSS/JSON, except SVG/XML namespaces, never-fetched framework
//   error-doc links, and licence/source links on the /licenses and /about pages;
// - an inline <script> whose sha256 hash is missing from the CSP script-src;
// - a missing _headers file, or a /* rule without COOP same-origin and COEP require-corp.
// Importing this module never runs the CLI.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
const TEXT_EXT = /\.(html?|m?js|css|json|webmanifest|svg|xml|txt)$/i;
const URL_RE = /https?:\/\/[^\s"'`<>()\\]+/gi;

/** URLs that are identifiers, not requests: XML namespaces and framework error-doc links. */
const ALLOWED_URL = [
  /^https?:\/\/www\.w3\.org\//i,
  /^https:\/\/svelte\.dev\/e\//i,
];

/** Pages whose job is to link to licences and sources. */
const LINK_PAGES = /^(licenses|about)\//;

export function parseHeaders(text) {
  const rules = new Map();
  let current = null;
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      current = rules.get(raw.trim()) ?? {};
      rules.set(raw.trim(), current);
      continue;
    }
    if (!current) continue;
    const idx = raw.indexOf(':');
    if (idx < 0) continue;
    const name = raw.slice(0, idx).trim().toLowerCase();
    const value = raw.slice(idx + 1).trim();
    current[name] = current[name] ? `${current[name]}, ${value}` : value;
  }
  return rules;
}

function scriptSrc(csp) {
  for (const part of (csp ?? '').split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name?.toLowerCase() === 'script-src') return sources;
  }
  return [];
}

export function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (/\ssrc\s*=/.test(attrs)) continue;
    if (/\stype\s*=\s*["']?(application\/(ld\+)?json|importmap|speculationrules)["']?/i.test(attrs)) continue;
    out.push(m[2]);
  }
  return out;
}

export const sha256Base64 = (text) => createHash('sha256').update(text, 'utf8').digest('base64');

export function checkDist({ files, headers }) {
  const problems = [];

  let rootRule = null;
  if (headers == null) {
    problems.push('_headers is missing: COOP/COEP and the CSP would not be served');
  } else {
    rootRule = parseHeaders(headers).get('/*');
    if (!rootRule) problems.push('_headers has no /* rule');
    else {
      if (rootRule['cross-origin-opener-policy'] !== 'same-origin') {
        problems.push('_headers /* is missing Cross-Origin-Opener-Policy: same-origin (COOP)');
      }
      if (rootRule['cross-origin-embedder-policy'] !== 'require-corp') {
        problems.push('_headers /* is missing Cross-Origin-Embedder-Policy: require-corp (COEP)');
      }
      if (!rootRule['content-security-policy']) problems.push('_headers /* is missing Content-Security-Policy');
    }
  }
  const allowedHashes = new Set(scriptSrc(rootRule?.['content-security-policy']));

  for (const file of files) {
    const path = file.path.split('\\').join('/');
    if (file.size > MAX_FILE_BYTES) {
      problems.push(`${path} is ${(file.size / 1024 / 1024).toFixed(1)} MiB, over the 25 MiB per-file cap`);
    }
    if (typeof file.text !== 'string') continue;

    if (!LINK_PAGES.test(path)) {
      const seen = new Set();
      for (const url of file.text.match(URL_RE) ?? []) {
        if (ALLOWED_URL.some((re) => re.test(url)) || seen.has(url)) continue;
        seen.add(url);
        problems.push(`${path} contains an absolute URL: ${url}`);
      }
    }

    if (/\.html?$/i.test(path)) {
      for (const script of inlineScripts(file.text)) {
        const hash = `'sha256-${sha256Base64(script)}'`;
        if (!allowedHashes.has(hash)) problems.push(`${path} has an inline script whose hash ${hash} is not in script-src`);
      }
    }
  }
  return problems;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

export function readDist(distDir) {
  const files = walk(distDir).map((abs) => {
    const path = relative(distDir, abs).split(sep).join('/');
    const size = statSync(abs).size;
    return TEXT_EXT.test(path) && size < MAX_FILE_BYTES ? { path, size, text: readFileSync(abs, 'utf8') } : { path, size };
  });
  const headersPath = join(distDir, '_headers');
  return { files, headers: existsSync(headersPath) ? readFileSync(headersPath, 'utf8') : null };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dist = process.argv[2] ?? fileURLToPath(new URL('../dist/', import.meta.url));
  if (!existsSync(join(dist, 'index.html'))) {
    console.error(`check-dist: ${dist} has no index.html; run "npm run build" first`);
    process.exit(1);
  }
  const input = readDist(dist);
  const problems = checkDist(input);
  if (problems.length) {
    console.error(`check-dist: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`check-dist: OK (${input.files.length} files)`);
}
