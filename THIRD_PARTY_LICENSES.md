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
