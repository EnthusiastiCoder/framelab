#!/usr/bin/env node
// Small static server for dist/ that applies the rules in dist/_headers to every response (404s included),
// so the e2e tests run against the same headers Cloudflare Pages serves. PORT defaults to 4799.
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHeaders } from './check-dist.mjs';

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT ?? 4799);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
  '.webm': 'video/webm',
};

function loadRules() {
  const file = join(ROOT, '_headers');
  return existsSync(file) ? [...parseHeaders(readFileSync(file, 'utf8')).entries()] : [];
}

/** Cloudflare-style pattern match: `*` matches any run of characters (including '/'). */
function matches(pattern, path) {
  const re = new RegExp('^' + pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return re.test(path);
}

function headersFor(path) {
  const out = {};
  for (const [pattern, headers] of loadRules()) {
    if (!matches(pattern, path)) continue;
    for (const [name, value] of Object.entries(headers)) out[name] = value;
  }
  return out;
}

function resolveFile(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const abs = normalize(join(ROOT, p));
  if (abs !== ROOT && !abs.startsWith(ROOT + sep)) return null;
  const candidates = [abs, join(abs, 'index.html'), abs + '.html'];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

export function startServer(port = PORT) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const headers = headersFor(path);
    let file = path.endsWith('/_headers') ? null : resolveFile(path);
    let status = 200;
    if (!file) {
      status = 404;
      file = existsSync(join(ROOT, '404.html')) ? join(ROOT, '404.html') : null;
    }
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const size = statSync(file).size;
    res.writeHead(status, {
      'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': size,
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`serve-dist: http://127.0.0.1:${port}/ (dist/ with _headers applied)`);
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer();
