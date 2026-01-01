# Proposal D: Framelab, a local media lab (watermark-free video tools plus local subtitles)

Date: 2026-11-22. Planner: cto-orchestrator planner. Research: `C:/Users/enthu/Projects/Portofolio/research/portfolio-tools/00-synthesis.md` (section D) and `04-media-office-tools.md` (LIVE checks 2026-11-22).

## Goal

A new, standalone static web app that runs 100% in the visitor's browser, with no watermark, no caps, no signup, no ads and no analytics. It covers:

- **Video:** trim, cut (remove sections), compress, convert, to GIF, mute, extract audio, and resize/crop for vertical formats.
- **Audio:** a cutter and a converter.
- **Auto-subtitles:** Whisper in the browser, exporting SRT/VTT and burned-in captions.

Each tool has its own SEO landing page, and the tool is usable right on that page. The app works offline as a PWA and is hosted on Cloudflare Pages with COOP/COEP set in `_headers`. The polish must beat Kapwing's and Clideo's free experience. Kapwing free (LIVE): 4 min, 720p, 30 min a month, watermark, sign-in, SRT/VTT download paid, Trustpilot 1.8. Clideo free (LIVE): watermark, 500 MB.

Proposed name: **Framelab**. The workspace is `C:/Users/enthu/Projects/Framelab` and the repo is `EnthusiastiCoder/framelab`. Checked on 2026-11-22: the folder does not exist, and `gh repo view EnthusiastiCoder/Framelab` gives "Could not resolve to a Repository". The domain was not checked. Alternatives are listed under Open questions.

## Standards and constraints

From the user's brief (verbatim): "projects that people could actually use... we will provide ad free, 0 cost solution... they just open their browser and get to it. and everything runs in their browser". The four proposals are built as "separate sites and projects and repos".

Hard constraints from the CTO brief:
- New workspace `C:/Users/enthu/Projects/Framelab`. Setup follows `C:/Users/enthu/Projects/Portofolio/prompts/setup.md`. The brief says `prompts/setup-workspace.md`, but that file does not exist. `setup.md` is the setup prompt; it describes itself as `prompts/setup-workspace.md` "moved here after initial setup". Setup is WS0.
- 100% client-side, no watermark, no caps: video trim, cut, compress, convert, to GIF, mute, extract audio, resize/crop for vertical formats; an audio cutter and converter; auto-subtitles with Whisper in the browser (the model is downloaded on demand and cached), exporting SRT/VTT and burned-in captions.
- **No caps** means no artificial limits of any kind: duration, count, resolution, file size or daily use. Only real device limits apply, and they are handled gracefully with a clear message, never a crash.
- Prefer WebCodecs/mediabunny, with an ffmpeg.wasm fallback. Handle memory limits for large files gracefully. COOP/COEP come from the Cloudflare Pages `_headers` file. Verify the licences (ffmpeg LGPL/GPL builds matter).
- No analytics, no third-party requests, no ads, no signup. PWA. Models are downloaded from Hugging Face: that is decided below and disclosed.
- One SEO landing page per tool. Quality bar: a polished UI that beats Kapwing's and Clideo's free experience. Playwright e2e tests use our own small generated media fixtures, plus unit tests.
- The GitHub repo is created **PRIVATE**. Going public and deploying form the final gated step, which needs the user's explicit approval.
- Git: one file per commit, `git add` and `git commit` run as separate commands, never commit on main (the one exception is the setup commit that setup.md prescribes), **no Co-Authored-By line**. The user's CLAUDE.md overrides any attribution reminder. Check `git diff --cached` before every commit.
- Git identity, set per repo: `Arpan Mandal <enthusiasticoder@gmail.com>`, using `git config user.name` and `git config user.email` without `--global`.
- **History spread** (user, verbatim): "spread these evenly in my contribution history from January this year". Commit normally during the build. Make commits granular (file level, and hunk level where one file holds separable changes) so there is material to spread. **No empty or noise commits.** The spread itself is **not** written here: it is the shared workstream in the image-suite plan, which re-runs `C:/Users/enthu/Projects/repo-publisher/src/spread` (design: `C:/Users/enthu/Projects/Portofolio/plans/2026-11-14_ws6c-varied-spread.md`) over all 4 new repos for 2026-01-01 to today. Its steps are a dry-run calendar, user approval, then apply. **It is applied before any push.** So nothing in this repo is pushed until that workstream has been applied.
- User CLAUDE.md rules carried into the new workspace: ask before building (the CTO has the answers), plans go in `plans/`, research in `research/`, kit pages on the info server. Use the Chrome DevTools rules for any live browser check: stop on a block, never defeat it.

### Decisions made in this plan (defaults unless the user overrides; see Open questions)

| Topic | Decision | Why |
|---|---|---|
| Framework | Astro 5 (static output) + Svelte 5 islands + TypeScript (strict). Plain CSS with custom-property design tokens. npm. | Static HTML for each SEO page; small hydrated islands; low JS on landing pages. |
| Primary engine | `mediabunny` (WebCodecs) in a dedicated Web Worker. Reads stream from the `File` (`BlobSource`) and are never loaded whole. | Fast, hardware codecs, no file-size ceiling on input. |
| Fallback engine | `@ffmpeg/ffmpeg` + `@ffmpeg/util`. The core is `@ffmpeg/core-mt` when `crossOriginIsolated`, else `@ffmpeg/core`. Lazy-loaded only when the planner picks it. Input mounted with WORKERFS (no copy). | Covers codecs/containers WebCodecs cannot do (e.g. Firefox AAC encode, FLAC, odd inputs). |
| Hosting of big binaries | Self-host on our own origin. Any file over 24 MiB (the Cloudflare Pages per-file cap is 25 MiB; re-verify) is split into `.partN` chunks by `scripts/vendor-assets.mjs`. The browser reassembles them into a Blob URL and checks a SHA-256 written at build time. | Keeps "zero third-party requests" for code. |
| Whisper runtime | `@huggingface/transformers` (v3) `automatic-speech-recognition` pipeline in its own worker. WebGPU when available, else WASM. `env.backends.onnx.wasm.wasmPaths = '/vendor/ort/'` (self-hosted, never jsDelivr), `env.allowLocalModels = false`, browser cache on. | The researched default; WebGPU speed, WASM fallback. |
| Whisper models | Registry: `onnx-community/whisper-tiny`, `whisper-base` (default), `whisper-small` (labelled "best, large download, WebGPU recommended"). Each is **pinned to a 40-hex revision**, with byte sizes measured at implementation time. Weights are MIT (OpenAI Whisper); verify on each model card. | Quality vs download trade-off is visible to the user. |
| Model hosting | **Downloaded from Hugging Face on demand**, only after an explicit consent dialog. The dialog names the hosts (`huggingface.co` plus its CDN redirect hosts, verified at build), the exact size, and says audio never leaves the device. Cached by transformers.js in the Cache API. Disclosed on `/privacy` and on the subtitles page. This is the **only** third-party request the app can ever make, and only after consent. CSP `connect-src` allowlists exactly those hosts. | Model files exceed the per-file cap, and self-hosting would need R2 plus a custom domain. The brief explicitly allows HF if disclosed. |
| GIF encoder | `gifenc` (MIT) in the worker, fed frames from mediabunny `CanvasSink`. | Small and fast. |
| MP3 encode | `@mediabunny/mp3-encoder` (LAME, LGPL; verify) registered as a custom encoder. ffmpeg (libmp3lame) is the fallback. | WebCodecs has no MP3 encoder. |
| Fonts | Inter (OFL-1.1), self-hosted woff2, also used for burned-in captions. | No Google Fonts request. |
| PWA | `@vite-pwa/astro` (Workbox, `generateSW`). Precache the app shell and pages. Runtime-cache `/vendor/*` (CacheFirst) on first use. Models are cached by transformers.js, not by the service worker. | Offline after first use. |
| Project licence | **Default: GPL-3.0-or-later.** `@ffmpeg/core` builds bundle libx264/libx265 and are GPL (verify in their LICENSE/package.json), so GPL for the whole repo removes all ambiguity. MPL-2.0 (mediabunny), Apache-2.0, MIT and LGPL are compatible with GPLv3, unless a file carries MPL's "Incompatible With Secondary Licenses" notice: check. | Open question 2 lets the user choose MIT with ffmpeg core as a separately distributed GPL component instead. |
| Test browsers | Playwright: `msedge` channel (primary; Edge is installed on this Windows machine and has the proprietary H.264/AAC codecs), bundled `chromium` (no H.264/AAC, so it naturally exercises the fallback/VP9 paths), `firefox` (WebCodecs, partial codecs), `webkit` (smoke: pages, headers, capability banner). | Real coverage of both engine paths. |
| Fixtures | Generated by `scripts/gen-fixtures.mjs` using the local ffmpeg 7.1.1 CLI (installed at the WinGet Gyan path) and Windows SAPI TTS (`System.Speech`, via PowerShell) for speech. Committed, each under 500 KB, all under 3 MB total. Tests probe outputs with mediabunny in Node (metadata only), so ffprobe is not needed at test time. | Our own media, no licence questions. |
| Branching | WS0's single setup commit lands on `main`, as setup.md prescribes. Every later commit goes on **one branch, `feat/media-lab`**, worked sequentially across WS1 to WS4, with no merges. `main` is updated only in the final gate, after the history spread and with approval. | No merge commits to complicate the date rewrite; never commit to main. |

## Architecture (shared reference for all workstreams)

```
C:/Users/enthu/Projects/Framelab/
  CLAUDE.md, .claude/, .mcp.json, prompts/         (gitignored, per setup.md)
  tools/info-server/                               (code committed, content/ gitignored)
  .gitignore  package.json  package-lock.json  astro.config.mjs  tsconfig.json
  vitest.config.ts  playwright.config.ts  README.md  LICENSE  THIRD_PARTY_LICENSES.md
  public/_headers  public/favicon.svg  public/icons/*  public/fonts/Inter-*.woff2
  public/vendor/                                   (GENERATED by scripts/vendor-assets.mjs, gitignored)
  scripts/gen-fixtures.mjs  scripts/vendor-assets.mjs  scripts/serve-dist.mjs  scripts/check-dist.mjs  scripts/fetch-test-model.mjs
  src/content/config.ts  src/content/tools/<slug>.md     (SEO copy, FAQ, how-to, related)
  src/pages/index.astro  src/pages/[slug].astro  src/pages/privacy.astro  src/pages/licenses.astro  src/pages/about.astro  src/pages/404.astro
  src/layouts/Base.astro  src/layouts/ToolPage.astro
  src/styles/tokens.css  src/styles/global.css
  src/lib/tools.ts                                  (tool registry: slug -> island component, engine op, accepts)
  src/components/*.svelte                           (DropZone, VideoPreview, Timeline, RangeHandles, Waveform, CropOverlay,
                                                     ProgressPanel, ExportPanel, ErrorCard, CapabilityBanner, NetworkProof,
                                                     ModelConsentDialog, SubtitleEditor, CaptionStylePanel, ThemeToggle)
  src/components/tools/*.svelte                     (one island per tool, composing the above)
  src/engine/types.ts        Job union, Progress, Result, EngineError codes
  src/engine/client.ts       main-thread API: run(job, {onProgress, signal}) -> Result; restarts the worker after a fatal error
  src/engine/worker.ts       dispatcher in a dedicated module worker
  src/engine/capabilities.ts detect: WebCodecs, per-codec canEncode/canDecode (mediabunny), crossOriginIsolated, SAB,
                             showSaveFilePicker, navigator.deviceMemory, WebGPU, OffscreenCanvas
  src/engine/planner.ts      PURE: (job, caps, inputInfo) -> {path: 'webcodecs'|'ffmpeg', reason}
  src/engine/memory.ts       PURE: (job, inputSize, estimate, caps, path) -> {ok, sink: 'disk'|'memory', warn?, block?, message}
  src/engine/timecode.ts     PURE: parse/format "hh:mm:ss.mmm", "mm:ss", seconds; frame snapping
  src/engine/compress.ts     PURE: target size or quality preset -> video/audio bitrate, resolution suggestion
  src/engine/crop.ts         PURE: aspect presets (9:16, 1:1, 4:5, 16:9, free) + mode (crop | fit-with-pad | fit-with-blur) -> rects, even dims
  src/engine/output.ts       sinks: FSA StreamTarget (disk) | BufferTarget (memory); suggested filename "<name>-framelab.<ext>"
  src/engine/mediabunny/{probe,convert,ranges,audio,gif}.ts
  src/engine/ffmpeg/{loader,args,run}.ts    args.ts PURE per-job argv builders
  src/subtitles/{models,asr-worker,audio16k,segment,srt,vtt,style,burn}.ts
  tests/unit/*.test.ts   tests/e2e/*.spec.ts   tests/helpers/{probe,fixtures,network}.ts   tests/fixtures/*
```

Engine rules:
- **One `convert` pipeline** (mediabunny `Conversion`) serves compress, convert, resize/crop, mute and trim (exact). Options: `trim {start,end}`; `video {codec, bitrate, width, height, fit, crop, frameRate, discard}`; `audio {codec, bitrate, numberOfChannels, sampleRate, discard}`.
  - Verify the installed mediabunny version's option names against its docs. If `crop` is missing, crop through the `video.process` frame callback onto an `OffscreenCanvas`.
- **`ranges.ts`** is a decode/re-encode pipeline over keep-ranges: mediabunny `VideoSampleSink`/`AudioSampleSink` feeding `VideoSampleSource`/`AudioSampleSource` with re-based timestamps. It serves **cut** (remove sections) and **burn-in** (an optional per-frame hook that draws onto the frame). It is the only place a frame hook exists.
- **Trim modes:**
  - "Exact" re-encodes from the precise start.
  - "Fast, no quality loss" copies packets from the previous keyframe (via `EncodedPacketSink` and `EncodedVideoPacketSource`, or by letting Conversion skip the re-encode when no transform is set). The UI states that this mode snaps to a keyframe.
- **Progress:** every job reports `{phase, ratio 0..1, etaSeconds?}`. Every job can be cancelled through an `AbortSignal`: Conversion `cancel()`, or terminating the worker for ffmpeg.
- **Errors:** errors map to codes `UNSUPPORTED_INPUT | UNSUPPORTED_OUTPUT | OUT_OF_MEMORY | CORRUPT_INPUT | CANCELLED | INTERNAL`.
  - `RangeError`, "memory access out of bounds" and allocation failures become `OUT_OF_MEMORY`.
  - The UI shows an `ErrorCard` with a concrete next step: "Try Chrome or Edge", "Lower the resolution", or "Turn on save-to-disk". It never shows a blank screen.
- **Memory policy (`memory.ts`):**
  - **Input:** the WebCodecs path streams its input, so there is no input limit. On the ffmpeg path, block inputs over 2 GiB (wasm32), with the message "this file is too large for compatibility mode; use Chrome/Edge".
  - **Output sink:** use disk (`showSaveFilePicker` + `StreamTarget`) when available, which allows any size. Otherwise use memory: warn when the estimate is over 512 MiB on devices with `deviceMemory <= 4`, or over 1 GiB elsewhere; block over 2 GiB with an explanation.
  - **ffmpeg MEMFS:** the output is counted against a 1.5 GiB budget.
  - Warnings never block silently; the user can continue.
- **Planner (`planner.ts`)** picks WebCodecs when every needed codec reports encode/decode support through mediabunny. Otherwise it picks ffmpeg.
  - `?engine=ffmpeg` (and a "Compatibility mode" switch in settings) forces ffmpeg. Tests use this.
  - The chosen path and reason show in a small "Engine: Fast (WebCodecs)" or "Engine: Compatibility (ffmpeg)" chip.
- **Network proof (`NetworkProof.svelte`):** a `PerformanceObserver` on `resource` entries counts requests whose origin is not `location.origin` and shows "0 requests to other sites". After the user consents to a model download, it lists the Hugging Face requests by name instead.

`public/_headers` (exact intent; the implementer adjusts script hashes and verifies Cloudflare syntax):
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Resource-Policy: same-origin
  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' <hashes-or-blob-as-needed>; worker-src 'self' blob:; connect-src 'self' https://huggingface.co <verified HF CDN hosts>; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
  X-Content-Type-Options: nosniff
/vendor/*
  Cache-Control: public, max-age=31536000, immutable
/_astro/*
  Cache-Control: public, max-age=31536000, immutable
```
Never use `'unsafe-inline'` or `'unsafe-eval'` for scripts. Use Astro's CSP hash support if the installed version has it; otherwise `check-dist.mjs` computes sha256 hashes of inline scripts and fails if they are missing from `_headers`. `scripts/serve-dist.mjs` is a small Node static server that serves `dist/` and **applies the rules parsed from `dist/_headers`**, so e2e tests run against the real headers.

Tools and pages (slug = page = SEO landing; the tool island is above the fold):

| Slug | Tool | Notes |
|---|---|---|
| `/` | Home: all tools grid + drop anywhere (routes by file type) | |
| `/compress-video` | Compress | presets (Small / Balanced / High quality) + "target size (MB)" |
| `/convert-video`, `/mov-to-mp4`, `/webm-to-mp4`, `/mp4-to-webm` | Convert | the variant pages preselect the output; same island |
| `/trim-video` | Trim | Exact / Fast modes |
| `/cut-video` | Cut (remove one or more sections) | ranges.ts |
| `/video-to-gif` | To GIF | fps 5-30, width, loop, start/end |
| `/mute-video` | Mute | audio discard, video copied when possible |
| `/extract-audio`, `/video-to-mp3` | Extract audio | MP3 / M4A / WAV / Opus |
| `/resize-video`, `/crop-video` | Resize/crop | 9:16 (Reels/Shorts/TikTok), 1:1, 4:5, 16:9, free; crop / fit-pad / fit-blur; drag crop overlay |
| `/audio-cutter` | Audio cutter | waveform, range, fade in/out |
| `/audio-converter` | Audio converter | MP3, M4A (AAC), WAV, Opus (OGG), FLAC (ffmpeg) |
| `/auto-subtitles` | Auto-subtitles | Whisper, editor, SRT/VTT/burn-in |
| `/burn-subtitles` | Burn subtitles from your own SRT/VTT | shares the burn pipeline |
| `/privacy`, `/licenses`, `/about`, `/no-watermark-video-editor` | Trust and comparison pages | the comparison cites the dated LIVE checks only (no unverified competitor claims) |

## Workstreams

All work is in `C:/Users/enthu/Projects/Framelab`.

- **Workflow:** WS1 to WS4 run sequentially on `feat/media-lab`.
- **Tests first:** at the start of each workstream the implementer writes that workstream's test cases (section "Test cases") and commits them one file per commit. A planner-time test-writer was not used because the repo does not exist before WS0.
- **Commit rules for every commit listed below:** one file per commit; run `git diff --cached` first; `git add <file>` and `git commit -m "..."` as separate commands; no Co-Authored-By; Conventional Commit messages.
- **Granularity:** when a file grows in separable steps (e.g. one tool's options and then its UI states), commit each step separately, staging at hunk level (`git add -p` cannot be used interactively here, so write the file in stages and commit each stage). No empty or cosmetic noise commits.
- **Commit lists are minimums.** More granular commits are welcome.

### WS0: Workspace setup (model: sonnet)

**Task.** Create the workspace exactly as `C:/Users/enthu/Projects/Portofolio/prompts/setup.md` says, with `{{CWD}}` = `C:\Users\enthu\Projects\Framelab` and `{{CWD_POSIX}}` = `/c/Users/enthu/Projects/Framelab`.

Steps:
1. `mkdir C:/Users/enthu/Projects/Framelab`; `git init -b main`; `git config user.name "Arpan Mandal"`; `git config user.email enthusiasticoder@gmail.com`.
2. Write `CLAUDE.md` from setup.md's template, with the Shell section updated and the "Current prompts" list including `prompts/setup-workspace.md` and `tools/info-server/INFO-SERVER.md`.
3. Write `.claude/settings.json` (the allow list verbatim, plus `Bash(bun:*)` and `Bash(gh repo:*)`), with the hook command pointing at a verified Python path (`which python` / `where python`; prefer a concrete install over the WindowsApps alias).
4. Write `.claude/hooks/check-allowlist.py` (exact contents from setup.md) and `.claude/skills/introspect/SKILL.md` (exact contents, `mistakes/` path updated to the Framelab root).
5. Write `.mcp.json` (the agent-browser wrapper, exactly as given).
6. Copy setup.md to `prompts/setup-workspace.md`, and copy `prompts/chrome-devtools-mcp.md` from Portofolio.
7. Info server, following setup.md's 6 steps:
   - Copy the code from `C:/Users/enthu/Projects/Setup Prompts/info-server/code/tools/info-server/`.
   - Run `bun tools/info-server/port.ts register`. The next free port is expected to be 8797; never hand-edit `ports.json`.
   - Copy the starter content, run the how-it-works builder, then `check.ts` (expect `ok: 4 terms, 1 artifacts`).
   - Smoke test `/api/health`, then `taskkill /F /T` the server.
   - Add the CLAUDE.md snippet with the real port.
8. `.gitignore`: `CLAUDE.md`, `.claude/`, `.mcp.json`, `prompts/`, `tools/info-server/content/`, plus `node_modules/`, `dist/`, `.astro/`, `public/vendor/`, `test-results/`, `playwright-report/`, `tests/.models/`, `.env*`.
9. Mark the workspace trusted: set `projects["C:/Users/enthu/Projects/Framelab"].hasTrustDialogAccepted: true` in `~/.claude.json` (match the key format of existing entries), or tell the CTO the user must accept the dialog once.
10. Create the GitHub repo **private, empty, no push**: `gh repo create EnthusiastiCoder/framelab --private --description "Free, private video and audio tools that run in your browser. No watermark, no upload, no signup."`; then `git remote add origin https://github.com/EnthusiastiCoder/framelab.git`. Do **not** push.
11. Create the branch `feat/media-lab` for all later work.

**Commits.**
1. On `main`: `chore: initial workspace setup` (the setup commit setup.md prescribes; it contains `.gitignore` only, since everything else in setup is gitignored).
2. Switch to `feat/media-lab`. Commit `tools/info-server/` one file at a time (`chore(info-server): add <file>`). Several files may make this 10+ commits, which is fine because they are real files.

**Acceptance.** `git log main --oneline` has exactly 1 commit, authored `Arpan Mandal <enthusiasticoder@gmail.com>`. `gh repo view EnthusiastiCoder/framelab --json visibility` gives `PRIVATE`. `git ls-remote origin` is empty (nothing pushed). The info server health check returns the registered port. `git status` is clean, and CLAUDE.md, .claude and .mcp.json are untracked and ignored.

**Verify.** Run the commands above, plus `git log --format='%an <%ae>' | sort -u` and `bun tools/info-server/port.ts lookup`.

### WS1: App shell, design system, engine core, headers and test harness (model: opus)

**Task.**
1. Scaffold Astro 5 + Svelte 5 + TS strict. `npm i` the pinned deps: astro, @astrojs/svelte, svelte, mediabunny, @mediabunny/mp3-encoder, @ffmpeg/ffmpeg, @ffmpeg/util, @ffmpeg/core, @ffmpeg/core-mt, @huggingface/transformers, gifenc, @vite-pwa/astro. Dev deps: vitest, @playwright/test, @axe-core/playwright, jsdom, lighthouse.
2. **Licence audit:** read each package's LICENSE and package.json in node_modules (and the upstream repo when unclear). Record name, version, licence, source file, and how it is distributed in `THIRD_PARTY_LICENSES.md`. Explicitly check:
   - the @ffmpeg/core and core-mt licence and the bundled libs (x264/x265 make it GPL);
   - that mediabunny is MPL-2.0 with no "Incompatible With Secondary Licenses";
   - @mediabunny/mp3-encoder (LAME is LGPL);
   - transformers.js (Apache-2.0) and onnxruntime-web (MIT);
   - the Whisper weights licence on each pinned model card;
   - Inter (OFL-1.1).

   If anything contradicts the GPL-3.0-or-later default, stop and report it to the CTO.
3. Write `LICENSE` (GPL-3.0-or-later full text, unless the CTO relays a different user answer).
4. Build the design system:
   - Tokens: colour (light/dark, AA contrast), spacing, radius, type scale with Inter, motion with reduced-motion support.
   - `Base.astro`: header with the tools menu, footer with the privacy promise, theme toggle, skip link.
   - `ToolPage.astro`: H1, one-line promise, tool island above the fold, then how-to, FAQ and related tools from the content collection.
5. Build the components:
   - `DropZone` (drag, click, paste, keyboard; `accept` per tool; multiple-file rejection message);
   - `VideoPreview` (native `<video>` over a blob URL, frame-step keys);
   - `Timeline` + `RangeHandles` (thumbnails from mediabunny `CanvasSink`, keyboard: arrows nudge 1 frame, Shift+arrows 1 s, `I`/`O` set in/out, Space play);
   - `ProgressPanel` (phase, percent, ETA, Cancel);
   - `ExportPanel` (filename, size estimate, "Save to disk" when FSA is available, download);
   - `ErrorCard`, `CapabilityBanner` (lists unsupported features in plain words), `NetworkProof`.
6. Build the engine core: `types.ts`, `client.ts`, `worker.ts`, `capabilities.ts`, `planner.ts`, `memory.ts`, `timecode.ts`, `output.ts`, `mediabunny/probe.ts`, `ffmpeg/loader.ts` (chunk reassembly + SHA-256 check + toBlobURL for the core/wasm/worker), `ffmpeg/run.ts` (WORKERFS mount, progress parsing, terminate on cancel).
7. Scripts:
   - `scripts/vendor-assets.mjs` copies the ffmpeg core(s) and ORT wasm into `public/vendor/`, splits files over 24 MiB into parts, and writes `public/vendor/manifest.json` with sizes, hashes and part lists. Run it via `prebuild` and `predev`.
   - `scripts/serve-dist.mjs`.
   - `scripts/check-dist.mjs` fails on: any file over 25 MiB; any absolute `http(s)://` URL in built JS/HTML/CSS other than the allowlisted HF hosts, licence/source links in `/licenses` and `/about`, and SVG/XML namespaces; inline scripts missing a CSP hash; or a missing `_headers` with COOP/COEP.
8. Write `public/_headers` as above.
9. Write `scripts/gen-fixtures.mjs` and commit the generated fixtures (list in Test cases).
10. Configs: `vitest.config.ts` and `playwright.config.ts`. Playwright projects are msedge, chromium, firefox and webkit; the webServer runs `npm run build && node scripts/serve-dist.mjs`; downloads are kept.
11. `tests/helpers/probe.ts` reads an output file with mediabunny in Node and returns duration, width, height, video/audio codec, track count and frame rate.
12. Content collection schema (`src/content/config.ts`): title (≤ 60 chars), description (120 to 160 chars), h1, promise, howTo[], faq[], related[], ogImage. `index.astro` is the tools grid. `[slug].astro` has static paths from the collection, and the build fails if a registry slug has no content file or the other way round. `privacy.astro` and `licenses.astro` are rendered from THIRD_PARTY_LICENSES data. Add `404.astro`.
13. One working tool end to end to prove the stack: **`/mute-video`** on both engine paths.

**Files.** Everything under `src/engine/` (except the WS2 op modules), `src/components/*.svelte` (the shared ones above), `src/components/tools/MuteVideo.svelte`, `src/layouts/*`, `src/styles/*`, `src/pages/*`, `src/content/config.ts`, `src/content/tools/mute-video.md`, `src/lib/tools.ts`, `public/_headers`, the `public/` icons and fonts, `scripts/*` (except fetch-test-model), configs, `LICENSE`, `THIRD_PARTY_LICENSES.md`, `README.md` (first version), `tests/helpers/*`, `tests/fixtures/*`, and the WS1 tests.

**Commits** (one file each, in order; message → file):
- `chore: add package manifest` → package.json; `chore: lock dependencies` → package-lock.json
- `chore: configure astro with svelte and pwa` → astro.config.mjs; `chore: strict typescript config` → tsconfig.json
- `chore: vitest config` → vitest.config.ts; `chore: playwright config with four browser projects` → playwright.config.ts
- `chore: fixture generator` → scripts/gen-fixtures.mjs; then one commit per fixture file: `test: add <fixture> fixture`
- `test: media probe helper` → tests/helpers/probe.ts; `test: network helper` → tests/helpers/network.ts; `test: fixtures helper` → tests/helpers/fixtures.ts
- The WS1 test files, one commit each (`test: <area> cases`).
- `feat(engine): job and error types` → types.ts; `feat(engine): timecode parsing and formatting` → timecode.ts; `feat(engine): capability detection` → capabilities.ts; `feat(engine): engine path planner` → planner.ts; `feat(engine): memory and output-size policy` → memory.ts; `feat(engine): disk and memory output sinks` → output.ts; `feat(engine): media probe` → mediabunny/probe.ts; `feat(engine): ffmpeg chunked loader` → ffmpeg/loader.ts; `feat(engine): ffmpeg runner` → ffmpeg/run.ts; `feat(engine): ffmpeg argument builders (mute)` → ffmpeg/args.ts; `feat(engine): mediabunny convert pipeline (mute)` → mediabunny/convert.ts; `feat(engine): worker dispatcher` → worker.ts; `feat(engine): client with cancel and restart` → client.ts
- `build: vendor and chunk wasm assets` → scripts/vendor-assets.mjs; `build: static server that applies _headers` → scripts/serve-dist.mjs; `build: dist checks` → scripts/check-dist.mjs
- `feat: security and isolation headers` → public/_headers; then one commit per icon/font/favicon file.
- `style: design tokens` → tokens.css; `style: global styles` → global.css
- `feat(ui): base layout` → Base.astro; `feat(ui): tool page layout` → ToolPage.astro
- One commit per shared component (`feat(ui): <Component>`).
- `feat: tool registry` → src/lib/tools.ts; `feat(seo): tool content schema` → src/content/config.ts; `feat(seo): mute video copy` → mute-video.md
- `feat: home page`, `feat: tool page route`, `feat: privacy page`, `feat: licenses page`, `feat: 404 page`, `feat: about page`, one file each.
- `feat(tools): mute video` → MuteVideo.svelte
- `docs: licence` → LICENSE; `docs: third-party licences` → THIRD_PARTY_LICENSES.md; `docs: readme` → README.md

**Tests that must pass:** U1 to U9 and E1 to E9 (below).

**Acceptance.**
- `npm run build` and `node scripts/check-dist.mjs` pass.
- `/mute-video` works in msedge (WebCodecs) and with `?engine=ffmpeg` (ffmpeg core-mt, `crossOriginIsolated === true`).
- No request leaves the origin.
- `THIRD_PARTY_LICENSES.md` lists every shipped dependency with a verified licence.

**Verify.** `npm test`; `npx playwright test --project=msedge --project=chromium`; `node scripts/check-dist.mjs`.

### WS2: Video and audio tools (model: opus)

**Task.** Implement all remaining non-subtitle tools on the WS1 core, each as an island + content file + engine op, with both engine paths where the planner can choose ffmpeg:
- **compress** (`compress.ts` bitrate math; presets; target-size mode with 2-pass-free bitrate estimate, accuracy ±15%);
- **convert** (MP4 H.264/AAC, WebM VP9/Opus, MOV input, MKV input if mediabunny reads it, else ffmpeg);
- **trim** (Exact/Fast);
- **cut** (`ranges.ts`, multiple removed sections, list UI);
- **to GIF** (`gif.ts`: CanvasSink at the chosen fps/width, gifenc with a per-frame palette or a palette sampled from 10 frames, which is the default for quality; live size estimate);
- **mute**: already exists; make sure the video stream is copied without re-encoding when possible;
- **extract audio** (`audio.ts`: MP3 via mp3-encoder, M4A AAC via WebCodecs or ffmpeg, WAV via pure-JS PCM writer, Opus/OGG);
- **resize/crop** (`crop.ts` presets and modes, `CropOverlay.svelte` drag/resize with aspect lock, fit-blur draws a blurred, scaled copy behind the frame through the `process` callback);
- **audio cutter** (`Waveform.svelte` with peaks computed in the worker, range, fade in/out up to 10 s, output format = input format when encodable, else MP3);
- **audio converter** (MP3 bitrate 96 to 320, M4A, WAV, Opus, FLAC via ffmpeg).

Also add the variant landing pages (`/mov-to-mp4`, `/webm-to-mp4`, `/mp4-to-webm`, `/video-to-mp3`, `/crop-video`) as content files that preselect options.

**Files.** `src/engine/compress.ts`, `crop.ts`, `mediabunny/{convert,ranges,audio,gif}.ts`, `ffmpeg/args.ts` (the builders for every op), `src/components/{Waveform,CropOverlay}.svelte`, `src/components/tools/*.svelte` (Compress, Convert, Trim, Cut, ToGif, ExtractAudio, ResizeCrop, AudioCutter, AudioConverter), `src/content/tools/*.md` for each slug, `src/lib/tools.ts`, and the WS2 tests.

**Commits.** Tests first (one file each). Then per tool, in this order: the pure helper (if any), the engine op, the ffmpeg args builder addition (a separate commit for each op's builder, adding it to args.ts in stages), the island component, the content file, and the registry entry (each registry addition is its own commit with a real change). Example for compress:
1. `feat(engine): compress bitrate math` → compress.ts
2. `feat(engine): compress in convert pipeline` → mediabunny/convert.ts
3. `feat(engine): ffmpeg args for compress` → ffmpeg/args.ts
4. `feat(tools): compress video` → Compress.svelte
5. `feat(seo): compress video copy` → compress-video.md
6. `feat: register compress tool` → tools.ts

Repeat the pattern for all 10 tools and the 5 variant pages. The expected total is 70+ commits.

**Tests that must pass:** U10 to U16 and E10 to E24, plus all WS1 tests.

**Acceptance.**
- Every tool produces a valid output for every listed fixture in msedge.
- Every op with an ffmpeg builder also passes with `?engine=ffmpeg`.
- Bundled chromium (no H.264) automatically picks VP9/WebM or ffmpeg and says why.
- Cancel works mid-job and the tool is usable again.
- No watermark is ever added: the output frame pixels match the input frame within codec tolerance (E24).

**Verify.** `npm test`; `npx playwright test --project=msedge`; `npx playwright test --project=chromium --project=firefox --grep @cross`.

### WS3: Auto-subtitles and burn-in (model: opus)

**Task.**
1. `models.ts`: a registry entry for each model with id, a 40-hex pinned `revision`, `dtype` per device (WebGPU: encoder fp32/fp16 and decoder q4; WASM: q8), an exact byte total (measured from the HF API at implementation time), languages and a label.
2. `asr-worker.ts`:
   - transformers.js pipeline with `device: 'webgpu'` when `navigator.gpu` gives an adapter, else `'wasm'`; `env.backends.onnx.wasm.wasmPaths = '/vendor/ort/'`.
   - Progress callback for downloads (per-file bytes) and transcription (per 30 s chunk); `chunk_length_s: 30`, `stride_length_s: 5`, `return_timestamps: true`.
   - Language auto or chosen; task `transcribe` or `translate` (to English).
3. `audio16k.ts`: decode audio with mediabunny `AudioSampleSink`, downmix to mono, resample to 16 kHz in 30 s blocks (OfflineAudioContext, or a windowed-sinc resampler in the worker if OfflineAudioContext is not available in workers), and stream the blocks to the ASR worker. ffmpeg is the fallback decoder (`-ac 1 -ar 16000 -f f32le`).
4. `segment.ts`: Whisper chunks become cues of at most 2 lines and 42 characters per line. Long chunks split at punctuation, then at word boundaries, with time shared out by character count. Duration is at least 0.8 s and at most 7 s. No overlaps. Empty or hallucinated repeats are removed (the same text three or more times in a row collapses to one).
5. `srt.ts` / `vtt.ts`: serialize and parse with round-trip; the VTT parser handles cue settings.
6. `SubtitleEditor.svelte`:
   - a cue list with inline text edit, start/end nudge (±0.1 s), split at the cursor, merge with next, delete, and click a cue to seek;
   - live preview through a `<track>` blob URL, with undo/redo (Ctrl+Z / Ctrl+Shift+Z).
7. `ModelConsentDialog.svelte`: model name, exact size in MB, the hosts contacted, "your audio never leaves this device", a "Remember my choice" checkbox (localStorage), a cached state ("Already downloaded, 0 MB"), and a "Delete downloaded models" button on `/privacy` that clears the transformers cache.
8. `style.ts` + `CaptionStylePanel.svelte`: font size, colour, outline, background box on/off with opacity, position top/bottom, margin. `burn.ts` draws cues onto frames through the `ranges.ts` frame hook, using Inter loaded with the FontFace API into the worker's `OffscreenCanvas`.
9. Islands `AutoSubtitles.svelte` and `BurnSubtitles.svelte` (upload your own SRT/VTT + video), with content files for `/auto-subtitles` and `/burn-subtitles`.
10. `scripts/fetch-test-model.mjs` downloads whisper-tiny at the pinned revision once into `tests/.models/` (gitignored) for the slow e2e test, which serves those files through `page.route` on the HF URLs, so the test makes no live network calls.

**Files.** `src/subtitles/*`, `src/components/{SubtitleEditor,ModelConsentDialog,CaptionStylePanel}.svelte`, `src/components/tools/{AutoSubtitles,BurnSubtitles}.svelte`, `src/content/tools/{auto-subtitles,burn-subtitles}.md`, `src/lib/tools.ts`, `src/engine/mediabunny/ranges.ts` (frame-hook wiring only, if not already there), `public/_headers` (HF hosts, verified), `scripts/fetch-test-model.mjs`, `src/pages/privacy.astro` (model disclosure + delete button), and the WS3 tests.

**Commits.** Tests first. Then one commit per file in the order 1 to 10, with the consent dialog and editor split into staged commits (layout, then actions, then keyboard/undo) where they really are separate steps. The `_headers` and privacy changes are each their own commit.

**Tests that must pass:** U17 to U23 and E25 to E31, plus all earlier tests.

**Acceptance.**
- Subtitles are generated for the speech fixture. With whisper-tiny, at least 70% of words match the known script after normalisation (the slow test).
- The SRT and VTT downloads are valid.
- The burned-in MP4 has visible caption pixels in the expected region during cue time and none outside cue time.
- Before consent, there are zero requests to HF. After consent, requests go only to the allowlisted HF hosts. A second run makes 0 model requests (served from cache).

**Verify.** `npm test`; `npx playwright test --grep @subs`; `node scripts/fetch-test-model.mjs`, then `npx playwright test --grep @slow --project=msedge`.

### WS4: SEO, PWA, polish and quality bar (model: opus)

**Task.**
1. **SEO:**
   - Final copy for every tool page: unique title and description, H1, a 3-step how-to, 4 to 6 FAQs answering the real competitor pain points (watermark, upload, limits, signup) with neutral, dated wording, and related tools.
   - JSON-LD: `SoftwareApplication` (price 0) and `FAQPage`, plus `HowTo` where valid; BreadcrumbList.
   - Canonical URLs, `sitemap.xml` (`@astrojs/sitemap`), `robots.txt`, OG/Twitter meta, and an OG image per tool generated at build time as static PNG/SVG (no external service).
   - `/no-watermark-video-editor` comparison page citing only the LIVE checks dated 2026-11-22 (Kapwing, VEED, Clideo, CloudConvert 10/day, FreeConvert 20 min/day), each with its date.
2. **PWA:** manifest (name, icons 192/512/maskable, theme colours), service worker precache, an offline page, "Install app" in the header menu, and an update prompt.
3. **Polish against the quality bar** (checklist in Acceptance):
   - an empty state with a sample-file button (uses a tiny bundled sample so first-time users can try it instantly);
   - drag-anywhere;
   - a before/after size and duration summary on export;
   - "Process another" and "Use the result in another tool" (hand the output Blob to another tool's page through an in-memory `BroadcastChannel`/IndexedDB hand-off, with no upload);
   - a keyboard shortcuts sheet (`?`);
   - mobile layout down to 360 px;
   - dark mode;
   - the reduced-motion path;
   - toasts in an `aria-live` region.
4. **Performance:** the landing page's initial JS is at most 150 KB gzip. Engine, mediabunny, ffmpeg and transformers load lazily on first file or interaction. Fonts are preloaded. The LCP element is the H1.
5. Final `README.md` (what it does, privacy model, browser support matrix measured in E-tests, licences, how to run and test) and an updated `THIRD_PARTY_LICENSES.md`.
6. **Independent UI review:** take screenshots of every page at 1280 and 375 widths, light and dark, and give them to a separate reviewer agent along with the Acceptance checklist. Fix what it finds and record the result in the report.

**Files.** `src/content/tools/*.md`, `src/layouts/*`, `src/pages/*`, `src/components/*`, `astro.config.mjs`, `public/manifest.webmanifest`, `public/robots.txt`, `public/icons/*`, `scripts/og-images.mjs`, `README.md`, `THIRD_PARTY_LICENSES.md`, and the WS4 tests.

**Commits.** Tests first. One commit per content file rewrite, per JSON-LD helper, per meta change, and per polish feature (each feature touches one file per commit; a feature that spans files is split by file, in an order that keeps the build green).

**Tests that must pass:** U24 to U26 and E32 to E40, plus all earlier tests.

**Acceptance (quality bar checklist; every item must hold).**
1. No signup, no watermark, no cap anywhere. Output resolution equals the input or the user's choice, never forced down (contrast: Kapwing free 720p, 4 min, watermark).
2. Tool usable within 1 click of landing: the drop zone is visible above the fold at 1280×720 and 375×667.
3. Lighthouse (mobile) on `/`, `/compress-video` and `/auto-subtitles`: Performance ≥ 90, Accessibility 100, Best Practices ≥ 95, SEO 100.
4. axe: 0 serious or critical violations on every page.
5. Every long job shows phase, percent, ETA and Cancel; every failure shows an ErrorCard with a next step.
6. Offline: after one visit, `/trim-video` loads and trims with the network disabled.
7. "0 requests to other sites" is true on every page and every tool flow except a consented model download.
8. The reviewer agent signs off on the screenshots against items 1 to 7 plus visual consistency.

**Verify.** `npm test`; `npx playwright test` (all projects); `npx lighthouse http://localhost:<port>/compress-video --preset=desktop` and the mobile default (run through `npm run lh`); `node scripts/check-dist.mjs`.

### WS5: History spread (owned by the image-suite plan; this plan only feeds it) (no implementer here)

- **Do not write a script and do not run the spread from this plan.** The image-suite plan has the single shared workstream. It re-runs `C:/Users/enthu/Projects/repo-publisher/src/spread` (design: `C:/Users/enthu/Projects/Portofolio/plans/2026-11-14_ws6c-varied-spread.md`) over all 4 new repos for **2026-01-01 to today**, combined with the user's existing contribution graph:
  - each day's total stays between max/4 and max, where max is the existing busiest day (about 205);
  - no level-0 days;
  - mostly L3, then L2;
  - L4 rare and spaced apart, mostly on Mondays and Thursdays;
  - L1 about 3%, weekends only, Sunday preferred;
  - identity `Arpan Mandal <enthusiasticoder@gmail.com>`.
- Its steps are a dry-run calendar, then the user's approval, then apply. **It is applied before any push.**
- **What this plan must hand over:** the repo path `C:/Users/enthu/Projects/Framelab`; the branch `feat/media-lab` (and `main` with its 1 setup commit); a clean tree; no pushes; and granular, meaningful commits only (no empty/noise commits). Expect about 150 to 200 commits from WS0 to WS4.
- Note for whoever runs it: on 2026-11-22 the repo-publisher spread tests stand at 73 pass, 3 fail. One visible failure is `applyUnits > rebuilds history from the finest units with assigned dates and identity, leaving the working tree alone` (timed out at 6003 ms). That workstream must fix these first.

### WS6: Release gate: push, go public, deploy (model: sonnet). GATED: needs the user's explicit approval at each step.

Precondition: WS5's spread has been applied to this repo, and the user approved the calendar.

Steps, each needing explicit user approval relayed by the CTO:
1. **Pre-push audit:**
   - Secret scan of the whole history (repo-publisher audit, or `git log -p | grep` for keys/tokens).
   - Confirm no employer code.
   - Confirm `git log --format='%an <%ae>' | sort -u` shows only the user identity.
   - Confirm `git log --grep=Co-Authored-By` is empty.
   - Confirm README and LICENSE are present.
2. **Push to the private repo:** `git push -u origin feat/media-lab`. Open a PR into `main` with `gh pr create`. Merge only on approval, never by pushing to main directly (the hook blocks it anyway).
3. **Go public:** `gh repo edit EnthusiastiCoder/framelab --visibility public --accept-visibility-change-consequences`, only on explicit approval.
4. **Deploy:** create the Cloudflare Pages project (Git integration or `npx wrangler pages deploy dist`). Then verify the live headers with `curl -I` (COOP, COEP, CSP present) and that `crossOriginIsolated` is true in the live page, and run the E-suite smoke against the live URL (`BASE_URL=https://<project>.pages.dev npx playwright test --grep @smoke`). Only on explicit approval.

**Acceptance.** Each step has the user's recorded approval. The live site passes the @smoke suite and the header checks.

## Test cases

Unit tests are Vitest under `tests/unit`. E2E tests are Playwright under `tests/e2e`. Tags: `@cross` runs on all browsers, `@subs` covers subtitles, `@slow` uses the real model, `@smoke` is the minimal live check. Unless tagged otherwise, e2e tests run on `msedge`.

**Fixtures** (generated by `scripts/gen-fixtures.mjs`, committed):

| File | Content |
|---|---|
| `h264-aac-640x360-5s.mp4` | testsrc2 + 440 Hz sine, 30 fps, GOP 30 |
| `vp9-opus-640x360-5s.webm` | same content |
| `h264-1280x720-3s-noaudio.mp4` | |
| `h264-aac-3s.mov` | |
| `h264-aac-360x640-3s.mp4` | vertical |
| `h264-aac-1920x1080-4s.mp4` | for resize/crop |
| `speech-en.wav` and `speech-en.mp4` | SAPI TTS of the fixed script "Hello and welcome to Framelab. Everything here runs in your browser. Your files never leave your device." over a solid blue background |
| `tone-10s.mp3`, `tone-10s.wav`, `tone-10s.m4a`, `tone-10s.ogg` | |
| `sample.srt`, `sample.vtt` | 3 cues each |
| `corrupt.mp4` | first 20 KB of the h264 fixture |
| `not-media.mp4` | a text file |

### WS1
- **U1 timecode:** `parse("1:02:03.450")=3723.45`, `parse("02:03")=123`, `parse("12.5")=12.5`, invalid input throws; `format(3723.45)="01:02:03.450"`; snapping to 30 fps rounds to the nearest frame.
- **U2 planner:** picks webcodecs when all needed codecs are supported; picks ffmpeg when an encoder is missing (e.g. AAC on Firefox caps) and gives a reason string; `forceFfmpeg` always gives ffmpeg; picks ffmpeg for FLAC output.
- **U3 memory:** a disk sink is chosen when FSA is available, and any size is ok. The memory sink warns at more than 512 MiB when `deviceMemory = 4` and at more than 1 GiB when it is 8, and blocks at more than 2 GiB. The ffmpeg path blocks input over 2 GiB with a message that mentions Chrome/Edge. A warning never sets `block`.
- **U4 capabilities:** with mocked globals (no `VideoEncoder`, no `crossOriginIsolated`, no `showSaveFilePicker`, no `navigator.gpu`), each flag is reported correctly and nothing throws.
- **U5 ffmpeg args (mute):** gives `-i <in> -c:v copy -an <out>`, and the output name ends in `-framelab.mp4`.
- **U6 headers:** parsing `public/_headers` for `/*` gives COOP `same-origin`, COEP `require-corp`, and a CSP without `unsafe-eval`, with `'unsafe-inline'` absent from script-src and `connect-src` containing only `'self'` plus the allowlisted HF hosts.
- **U7 check-dist (pure function):** flags a 26 MiB file, flags `https://cdn.jsdelivr.net/...` inside a JS file, allows `https://huggingface.co` and licence links on `/licenses`, and flags a missing COEP.
- **U8 vendor manifest:** the chunk plan for a 60 MiB file is 3 parts, each at most 24 MiB; reassembly gives the same SHA-256 (tested on a generated buffer).
- **U9 content/registry:** every registry slug has a content file and the other way round; titles are at most 60 characters, descriptions 120 to 160, and both are unique across pages.
- **E1 @cross:** every page returns 200 with COOP/COEP from serve-dist, and `crossOriginIsolated === true` on chromium/msedge/firefox.
- **E2 @cross:** on page load, 0 resource requests to origins other than the page origin, and 0 `securitypolicyviolation` events.
- **E3:** `/mute-video` with `h264-aac-640x360-5s.mp4` downloads an output that probes to 1 video track, 0 audio tracks, duration 5 ± 0.1 s and 640×360.
- **E4:** the same as E3 with `?engine=ffmpeg`; the engine chip says Compatibility.
- **E5:** `corrupt.mp4` and `not-media.mp4` each show an ErrorCard with a next step; no uncaught page errors.
- **E6:** Cancel during the ffmpeg mute job returns to the ready state, and a second run succeeds.
- **E7:** the keyboard can do it all: Tab to the drop zone, Enter opens the file chooser, and the result can be exported using only the keyboard.
- **E8 @cross:** a CapabilityBanner appears when `VideoEncoder` is deleted through an init script, and the tool still works through ffmpeg.
- **E9:** `node scripts/check-dist.mjs` exits 0 on the real build (run as a test step).

### WS2
- **U10 compress:** for a 60 s input with a 25 MB target and 128 kbps audio, the video bitrate is about 3.2 Mbps (formula `(target*8 - audio*dur)/dur`, with a 3% container margin); presets map to sensible bitrates for each resolution; a target smaller than audio alone gives an error.
- **U11 crop:** 9:16 crop of 1920×1080 gives width 606 or 608 (even) by height 1080, centred; fit-pad gives a canvas of 1080×1920 with a scaled rect of 1080×608; every output dimension is even; free crop is clamped to the bounds.
- **U12 ranges:** removing [1,2] and [3,3.5] from 5 s gives keep ranges [0,1],[2,3],[3.5,5] and an output duration of 3.5; overlapping or unsorted removals are normalised.
- **U13 ffmpeg args:** builders for compress, convert, trim (exact and fast: `-ss` placed before or after `-i`), cut (filter_complex select/aselect or concat), gif (palettegen/paletteuse), extract-audio (mp3/m4a/wav/opus), resize/crop (scale/crop/pad/boxblur), audio-cut (atrim + afade), audio-convert (flac etc.). Snapshot each argv.
- **U14 gif:** frame count is round(duration × fps); the size estimator grows with width and fps.
- **U15 audio:** the WAV writer produces a correct RIFF header for 44.1 kHz stereo 16-bit; the fade gain curve is 0 at the start and 1 after the fade duration.
- **U16 waveform peaks:** a 10 s sine gives N peaks at about the amplitude; silence gives zeros.
- **E10 compress:** a "Small" preset output is smaller than the input; a target-size output is within ±15% of the target (use the 1080p fixture with a target of 50% of the input size); the resolution is preserved unless changed.
- **E11 convert:** webm→mp4 gives H.264/AAC MP4 with duration within ±0.1 s; mov→mp4 likewise; mp4→webm gives VP9/Opus.
- **E12 trim exact:** 1.0 to 3.0 s gives a duration of 2.0 ± 1 frame (0.034 s). **E13 trim fast:** the output duration is at least 2.0 s and at most 2.0 s + 1 GOP (1 s), and the UI shows the keyframe note.
- **E14 cut:** removing 1 to 2 s from 5 s gives 4.0 ± 0.07 s, with audio and video in sync (audio duration within 0.05 s of video).
- **E15 gif:** a 2 s range at 10 fps and width 320 gives a valid GIF (`GIF89a` magic), 20 ± 1 frames and width 320.
- **E16 extract audio:** MP3 has an audio-only output, its duration within ±0.1 s and an MP3 codec; also WAV and M4A.
- **E17 resize 9:16 crop:** 1080p in gives 606 or 608 × 1080 out; fit-blur gives an output aspect of 9:16.
- **E18 audio cutter:** `tone-10s.mp3` cut from 2 to 5 s with a 1 s fade gives 3.0 ± 0.05 s, and the first 10 ms RMS is near 0.
- **E19 audio converter:** wav→mp3 at 192 kbps, mp3→flac (ffmpeg path chosen automatically, engine chip says Compatibility), ogg→m4a.
- **E20 @cross (chromium):** convert to MP4 on bundled Chromium either succeeds through ffmpeg or offers WebM, with the reason shown.
- **E21:** every WS2 op passes again with `?engine=ffmpeg` (parametrised).
- **E22:** Cancel mid-compress on the WebCodecs path stops within 1 s and frees the worker; the next job works.
- **E23:** a forced memory warning (init script sets `deviceMemory=2`, no FSA, 1080p fixture with an artificially low threshold through a `?memtest` flag) shows the warning with Continue / Lower quality, and Continue completes.
- **E24 no watermark:** the decoded frame at t = 1.0 s of a compress output compared with the input frame has a mean absolute pixel difference under a small threshold in every corner region (no logo overlay).

### WS3
- **U17 srt:** serialising gives `1\n00:00:01,000 --> 00:00:02,500\nHello\n\n`; the parse → serialise round-trip is identical for `sample.srt`; CRLF and a BOM are tolerated.
- **U18 vtt:** gives the `WEBVTT` header and `00:00:01.000 --> 00:00:02.500`; cue settings survive a round-trip; parsing `sample.vtt` gives 3 cues.
- **U19 segment:** a 120-character, 9 s chunk splits into cues of at most 2 lines × 42 characters and each at most 7 s; times are monotonic with no overlap; a 0.3 s cue is extended to 0.8 s when there is room; a run of the same text repeated 3 or more times collapses.
- **U20 models:** every model has a 40-hex revision, a byte size above 0, and a label that includes the size in MB; the default is whisper-base; the URLs built for each model use only the allowlisted HF hosts.
- **U21 audio16k:** resampling a 1 s 44.1 kHz stereo sine gives 16000 mono samples at the same frequency (zero-crossing count within ±2%).
- **U22 burn layout:** a long cue wraps within the safe width (90% of frame width); the bottom position keeps the box inside the frame with the margin; the font size scales with frame height.
- **U23 consent state:** with no consent the download is not allowed; "Remember" persists; when the model is cached the dialog shows 0 MB to download.
- **E25 @subs:** with the ASR worker mocked (`?asr=mock` returns fixed chunks), uploading `speech-en.mp4` opens the editor with 3 or more cues, and the SRT and VTT downloads parse with our parsers and match the cue count.
- **E26 @subs:** before clicking Download model there are 0 requests to `huggingface.co`; declining consent keeps it at 0.
- **E27 @subs:** editor actions work (edit text, nudge, split, merge, delete, undo/redo) and the export reflects the edits.
- **E28 @subs:** burn-in with mock cues gives an MP4 with a duration within ±0.1 s; the frame at the middle of the cue has bright caption pixels in the bottom-centre region, and a frame outside cue time does not.
- **E29 @subs:** `/burn-subtitles` with `sample.srt` + the h264 fixture gives an output with the captions present (same pixel check).
- **E30 @subs @slow:** with the real whisper-tiny served locally through `page.route` from `tests/.models/` at the pinned revision, consent → download progress → transcription. At least 70% of the script words appear (lowercased, punctuation stripped). A second run in the same context requests 0 model files.
- **E31 @subs:** "Delete downloaded models" on `/privacy` empties the transformers cache (the cache keys count is 0 afterwards).

### WS4
- **U24 seo:** every page has a canonical URL, a unique title and description, valid JSON-LD (parses; `@type` includes `SoftwareApplication` on tool pages and `FAQPage` where FAQs exist); the sitemap contains every tool slug.
- **U25 manifest:** the manifest has name, start_url `/`, display `standalone`, icons 192 and 512 plus a maskable one.
- **U26 bundle budget:** a build-stats check confirms the initial JS of `/compress-video` is at most 150 KB gzip, and that mediabunny, ffmpeg and transformers chunks are not in the initial graph.
- **E32 @cross:** axe reports 0 serious or critical violations on every page, light and dark.
- **E33:** the drop zone is in the viewport at 1280×720 and 375×667 on every tool page.
- **E34:** offline: after the first visit and SW install, `context.setOffline(true)` and a reload of `/trim-video` still loads, and a trim completes.
- **E35:** Lighthouse thresholds (run in the `npm run lh` script, asserted from the JSON): mobile Perf ≥ 90, A11y 100, BP ≥ 95, SEO 100 on `/`, `/compress-video`, `/auto-subtitles`.
- **E36:** "Use the result in another tool": compress, then send to GIF, opens `/video-to-gif` with the file loaded and no network requests.
- **E37:** the sample-file button loads the bundled sample and the tool runs.
- **E38:** the `?` shortcut sheet opens and closes with Esc; focus is trapped and then restored.
- **E39 @cross:** the network proof badge says 0 on every page, and the full e2e run records 0 cross-origin requests except E30's routed HF requests.
- **E40 @smoke:** the home page and 3 tool pages load, COOP/COEP headers are present, `crossOriginIsolated` is true, and mute completes. This is the subset run against the live URL in WS6.

## Acceptance criteria

1. All 14 tools listed in the Goal work fully in the browser, with no upload, no watermark and no cap, in Edge/Chrome. Firefox works with automatic ffmpeg fallback where codecs are missing. Safari/WebKit shows a correct capability banner and works where its WebCodecs support allows; the measured matrix is in the README.
2. Every tool has its own SEO landing page, with the tool above the fold, unique meta, JSON-LD and a sitemap entry.
3. Auto-subtitles: Whisper runs locally (WebGPU or WASM). The model downloads only after consent, from the disclosed Hugging Face hosts, pinned to a revision and cached. SRT/VTT export is free, and burn-in works.
4. Zero third-party requests other than the consented model download. This is enforced by CSP, checked by `check-dist.mjs`, and proven by E2/E39 and the in-page badge. No analytics, ads or signup.
5. COOP/COEP come from `public/_headers`, and `crossOriginIsolated` is true, so threaded ffmpeg and ORT work.
6. Large files: the WebCodecs path streams its input; save-to-disk is used when available; clear warnings or blocks with next steps; no crash or white screen (E5, E22, E23).
7. Licences verified from the upstream LICENSE files and recorded in `THIRD_PARTY_LICENSES.md` and on `/licenses`. Project LICENSE is chosen per Open question 2 (default GPL-3.0-or-later).
8. PWA installable and offline after the first visit.
9. The quality bar checklist in WS4 passes, including Lighthouse, axe and the independent screenshot review.
10. All tests U1 to U26 and E1 to E40 pass (E30 when the test model is fetched).
11. Git: WS0's single setup commit is on `main` and everything else is on `feat/media-lab`. Every commit is one file (or an inseparable atomic set), authored `Arpan Mandal <enthusiasticoder@gmail.com>`, with no Co-Authored-By and no empty or noise commits. The GitHub repo is private, with nothing pushed until the history spread (image-suite plan) has been applied.
12. Going public and deploying happen only in WS6, on explicit user approval.

## Open questions

1. **Name:** "Framelab" (default). Alternatives: "Cutlocal", "Nomark", "Reelkit". The domain was not checked; deploy on `framelab.pages.dev` until a domain is chosen.
2. **Project licence:** GPL-3.0-or-later (default, safest with the GPL @ffmpeg/core) or MIT for our code, with the ffmpeg core shipped as a separate, unmodified GPL component plus its corresponding source. MIT needs care: we would host the matching source archive ourselves to meet the GPL source obligation.
3. **Model hosting:** Hugging Face on demand with consent (default, disclosed), or self-host the models on Cloudflare R2 under our own domain for a strict "zero third-party" claim, at the cost of an R2 bucket and a custom domain.
4. **Safari scope:** is "works where WebCodecs allows, else a clear banner" enough for launch, or must Safari be fully supported through the ffmpeg path?
5. **PR merge into main in WS6:** should the CTO merge after the user approves, or does the user merge on GitHub?
6. **Setup prompt path:** the brief named `prompts/setup-workspace.md`, which does not exist; the plan uses `C:/Users/enthu/Projects/Portofolio/prompts/setup.md`. Confirm.
7. **Vocal remover (Demucs)** and **office conversion** are out of scope; confirm they stay as later ideas.

## Decisions recorded at WS0 (2026-11-22, from the user via the CTO; these supersede the defaults above)

1. **Name:** Framelab is approved.
2. **Licence:** the app stays "© Arpan Mandal. All Rights Reserved." Ship a README notice plus a `COPYRIGHT` file, and no `LICENSE` file (the user's standing rule). This replaces the GPL-3.0-or-later default and WS1 steps 3 and 5's `LICENSE`. ffmpeg is used only as a separately loaded LGPL build (no GPL x264/x265 components), with third-party notices and a source link. If no viable LGPL build exists, flag it to the CTO. Do not go GPL.
3. **Whisper models:** self-hosted on the same origin, chunked under Cloudflare's 25 MiB file cap if needed. Zero third-party requests, so the Hugging Face consent flow, CSP HF hosts and "consented model download" exceptions are replaced by a same-origin download (still on demand, with a size notice).
4. **Safari:** supported where WebCodecs is available, with a clean fallback otherwise.
5. **PR merge and going public:** the user merges the PR and approves going public.
6. **Setup prompt:** `C:/Users/enthu/Projects/Portofolio/prompts/setup.md` (copied to `prompts/setup-workspace.md`).
7. **Out of scope:** the vocal remover and office conversion.

Workspace facts: info-server port is 8799 (registry); Python for the hook is `C:/Python312/python.exe`.
