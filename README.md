# Framelab

Free video tools that run entirely in your browser: no upload, no watermark, no sign-up and no limits.
Media is read and written on your device with WebCodecs, through [Mediabunny](https://github.com/Vanilagy/mediabunny).

v1 is WebCodecs-only. Browsers without WebCodecs see a clear "not supported in this browser" notice that points to
a recent Chrome, Edge, Safari or Firefox.

## Stack

- Astro 5 (static output) with Svelte 5 islands and TypeScript (strict)
- Mediabunny + WebCodecs in a dedicated module worker (`src/engine/`)
- Cloudflare Pages hosting; COOP/COEP and a strict CSP in `public/_headers`

## Develop

```sh
npm install
npm run dev          # local dev server
npm run build        # static build into dist/
npm run preview      # serve dist/ with the _headers rules applied (port 4799)
npm run check-dist   # file-size, absolute-URL, CSP-hash and header checks on dist/
npm test             # unit tests (vitest)
npx playwright test --project=msedge --project=chromium   # e2e tests against the built site
npm run fixtures     # regenerate the tiny test media in tests/fixtures/ (needs a local ffmpeg CLI)
```

## Privacy

The site makes no requests to other origins: the CSP `connect-src` is `'self'`. There are no analytics, cookies or ads.

## Licence

© Arpan Mandal. All Rights Reserved. See `COPYRIGHT`. Third-party components keep their own licences; see
`THIRD_PARTY_LICENSES.md`.
