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

Notes:
- mediabunny (MPL-2.0) is used unmodified. Its licence header is kept in the built worker file, and its source is
  available at the link above. Its licence text does not carry the "Incompatible With Secondary Licenses" notice.
- @astrojs/svelte (MIT, 7.2.5, https://github.com/withastro/astro) is a build-time integration; only the small
  client hydration helper it generates is shipped.
- @mediabunny/mp3-encoder contains a WebAssembly build of the LAME MP3 encoder, which is LGPL-2.0-or-later
  (not GPL). It is used unmodified, ships as its own separately loaded chunk, and LAME's source is available at
  https://lame.sourceforge.io/ . Its licence text is in `node_modules/@mediabunny/mp3-encoder/licenses/lame/`.
- @mediabunny/flac-encoder contains a WebAssembly build of libFLAC (BSD-3-Clause, © Xiph.Org Foundation); its
  licence text is in `node_modules/@mediabunny/flac-encoder/licenses/libflac/`.
- No ffmpeg build and no GPL code ship with Framelab. Video encoding uses the browser's own WebCodecs encoders.

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
