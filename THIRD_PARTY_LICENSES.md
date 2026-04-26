# Third-party licences

Framelab is © Arpan Mandal. All Rights Reserved. The built site ships the following open-source software.
Each licence was checked against the `LICENSE` file in the installed package. The same list is on the `/licenses` page.

## Shipped in the browser bundle (dist/)

| Package | Version | Licence | Source | Where it runs |
|---|---|---|---|---|
| mediabunny | 1.66.2 | MPL-2.0 | https://github.com/Vanilagy/mediabunny | engine worker (demux, mux, WebCodecs) |
| @mediabunny/mp3-encoder | 1.66.2 | MPL-2.0 (wraps LAME, LGPL-2.0-or-later) | https://github.com/Vanilagy/mediabunny | engine worker, loaded only for MP3 output |
| @mediabunny/flac-encoder | 1.66.2 | MPL-2.0 (wraps libFLAC, BSD-3-Clause) | https://github.com/Vanilagy/mediabunny | engine worker, loaded only for FLAC output |
| gifenc | 1.0.3 | MIT | https://github.com/mattdesl/gifenc | engine worker, loaded only for GIF output |
| svelte | 5.59.1 | MIT | https://github.com/sveltejs/svelte | tool islands (runtime) |
| astro | 5.18.2 | MIT | https://github.com/withastro/astro | island loader script |
| @huggingface/transformers | 3.8.1 | Apache-2.0 | https://github.com/huggingface/transformers.js/tree/3.8.1 | speech recognition worker, loaded only by auto-subtitles |
| @huggingface/jinja | 0.5.13 | MIT | https://github.com/huggingface/huggingface.js/tree/main/packages/jinja | bundled inside transformers.js |
| onnxruntime-web | 1.22.0-dev.20250409-89f8206ba4 | MIT | https://github.com/microsoft/onnxruntime | speech recognition worker (WebAssembly runtime `ort-wasm-simd-threaded.jsep.wasm`) |
| onnxruntime-common | 1.21.0 | MIT | https://github.com/microsoft/onnxruntime | bundled inside transformers.js |

Notes:
- mediabunny (MPL-2.0) is used unmodified. Its licence header is kept in the built worker file, and its source is
  available at the link above. Its licence text does not carry the "Incompatible With Secondary Licenses" notice.
- @astrojs/svelte (MIT, 7.2.5, https://github.com/withastro/astro) is a build-time integration; only the small
  client hydration helper it generates is shipped.
- @mediabunny/mp3-encoder contains a WebAssembly build of the LAME MP3 encoder (LAME 3.100, unmodified),
  which is licensed under the GNU Library General Public License version 2 or later (LGPL-2.0-or-later, not GPL).
  The full licence text is in [`licenses/LGPL-2.0.txt`](licenses/LGPL-2.0.txt) (copied verbatim from the package's
  `licenses/lame/COPYING`) and on the `/licenses` page. LAME's notice asks for a link to its site: https://lame.sourceforge.io/ .
  Exact-version sources:
  - LAME 3.100 source: https://sourceforge.net/projects/lame/files/lame/3.100/lame-3.100.tar.gz
    (SHA-256 `ddfe36cab873794038ae2c1210557ad34857a4b6bdc515785d1da9e175b1da1e`, as recorded by the package).
  - @mediabunny/mp3-encoder 1.66.2 (the version in package-lock.json), npm tarball:
    https://registry.npmjs.org/@mediabunny/mp3-encoder/-/mp3-encoder-1.66.2.tgz
  - The same version as a git tag, including the LAME bridge source and build steps:
    https://github.com/Vanilagy/mediabunny/tree/v1.66.2/packages/mp3-encoder
- **The MP3 encoder ships as a separate file.** In the built site, LAME and its bridge live only in
  `dist/_astro/mediabunny-mp3-encoder-<hash>.js` (served as `/_astro/mediabunny-mp3-encoder-<hash>.js`; the hash
  changes with each build). It is loaded only when you choose MP3 output, and no other Framelab code is in that file.
  You may replace that file with your own build of the encoder, including one made from a modified LAME (the build
  steps are in the package README at the git tag above); the rest of the site uses it only through its public
  `registerMp3Encoder` export.
- @mediabunny/flac-encoder contains a WebAssembly build of libFLAC (BSD-3-Clause, © Xiph.Org Foundation); its
  licence text is in `node_modules/@mediabunny/flac-encoder/licenses/libflac/`.
- No ffmpeg build and no GPL code ship with Framelab. Video encoding uses the browser's own WebCodecs encoders.
- @huggingface/transformers is licensed under the Apache License 2.0; the full text is in
  [`licenses/Apache-2.0.txt`](licenses/Apache-2.0.txt) (copied from the package's `LICENSE`) and on the `/licenses`
  page. The package has no NOTICE file. **Build-time change:** `scripts/vite-strip-remote-urls.mjs` removes the
  `http://` / `https://` prefix from the absolute URLs inside the transformers.js and onnxruntime-web sources (default
  hosts, documentation links in error messages and licence headers), so the built site names no third-party host.
  No program logic is changed; Framelab overrides those defaults at run time (models load from its own `/models/`, and
  the WebAssembly runtime from its own `/_astro/`).

## Downloaded on demand from this site (not in dist/)

The auto-subtitles tool downloads one speech model, only after the user confirms its size. The files are
mirrored from the pinned revisions below by `scripts/fetch-models.mjs` and served from Framelab's own origin
under `/models/` (files over 24 MiB in `.partN` chunks).

| Model | Revision | Licence | Source |
|---|---|---|---|
| Whisper tiny (ONNX, q8) | ff4177021cc41f7db950912b73ea4fdf7d01d8e7 | MIT (OpenAI Whisper weights) | https://huggingface.co/onnx-community/whisper-tiny , converted from https://huggingface.co/openai/whisper-tiny |
| Whisper base (ONNX, q8) | 27a07b4b52b3a4c5886134bb4320e93e1a4bbc7c | MIT (OpenAI Whisper weights); the conversion's model card says Apache-2.0 | https://huggingface.co/onnx-community/whisper-base , converted from https://huggingface.co/openai/whisper-base |
| Whisper small (ONNX, q8) | 36050c46d777d46dc4b5f43f6d90574fc38f8732 | MIT (OpenAI Whisper weights) | https://huggingface.co/onnx-community/whisper-small , converted from https://huggingface.co/openai/whisper-small |

The Whisper code and model weights were released by OpenAI under the MIT licence: https://github.com/openai/whisper/blob/main/LICENSE .

## Build and test tools (not shipped)

| Package | Licence |
|---|---|
| @astrojs/svelte | MIT |
| typescript | Apache-2.0 |
| vitest | MIT |
| @playwright/test | Apache-2.0 |
| @axe-core/playwright | MPL-2.0 |
| jsdom | MIT |

Test fixtures in `tests/fixtures/` are generated locally (ffmpeg CLI and Windows speech synthesis) and are our own media.

The sample files in `public/samples/` (offered by "Try a sample file") are copies of two of those fixtures
(`h264-aac-640x360-5s.mp4` and `tone-10s.m4a`: a generated test pattern and a sine tone), so they are our own media too.
The Open Graph images in `public/og/` and the app icons in `public/icons/` are rendered from Framelab's own markup by
`scripts/og-images.mjs`; they contain no third-party artwork or fonts.

WS4 (SEO, offline support, polish) added no new dependency: the service worker (`scripts/sw.mjs`), the sitemap
endpoint and the manifest are hand-written.
