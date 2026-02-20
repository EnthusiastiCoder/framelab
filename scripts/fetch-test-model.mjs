#!/usr/bin/env node
// E30 (@slow) fixture: mirrors whisper-tiny (about 44 MB) into tests/.models/ with the same paths the app
// requests under /models/ (minus that prefix), parts included. tests/.models/ is gitignored.
import { fileURLToPath } from 'node:url';
import { fetchModels } from './fetch-models.mjs';

const outDir = fileURLToPath(new URL('../tests/.models/', import.meta.url));
fetchModels({ ids: ['whisper-tiny'], outDir }).then(
  (n) => console.log(`fetched ${(n / 1e6).toFixed(1)} MB into ${outDir}`),
  (err) => {
    console.error(String(err?.message ?? err));
    process.exit(1);
  },
);
