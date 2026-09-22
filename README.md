# Chyron Studio

A browser-based motion graphics editor rebuilt from the original Chyron Generator. Create animated tile titles and expressive typography, then export them with a real alpha channel.

![Chyron Studio](docs/studio-preview.png)

## Run locally

Requires Node.js 22.12+ (Node.js 24 is also supported).

```bash
npm ci
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173/chyrongenerator/`.

```bash
npm run build
npm run preview
```

The application remains compatible with GitHub Pages at `/chyrongenerator/`. The deployment command is still `npm run deploy`. Set `base` in `vite.config.ts` if you host it at a different path.

## What’s new in 2.3 — Stream Images

Open **Stream Images** beside Chyron to create a complete image set from one host upload. Each output keeps its own background and framing:

| Output       | Exact PNG size    | Default background      |
| ------------ | ----------------- | ----------------------- |
| Hero image   | 900 × 1200 · 3:4  | Blue grid               |
| Host card    | 1024 × 1024 · 1:1 | Editable color gradient |
| Stream image | 1200 × 1200 · 1:1 | Savvy                   |

- The supplied Blue grid, Savvy and Super Savvy backgrounds are bundled unchanged. Upload your own backgrounds, or choose a gradient, solid color or transparency.
- Upload a host once; all three previews update. Transparent padding is ignored when fitting the host. Drag to position, adjust size/rotation, flip, add a shadow or fade, and customize each image independently.
- Download one full-resolution PNG or all three in one ZIP. Preview guides are excluded. Preview, thumbnail and download use the same renderer.
- Images and settings save together in IndexedDB on this device. Undo/redo is separate from the Chyron editor; switching tools keeps both projects and their in-session history.
- PNG, JPEG and WebP are supported, up to 20 MB / 24 megapixels per image. Use a transparent PNG for a cutout: this feature composites uploaded images and does not remove photo backgrounds.

See [Stream Images guide](docs/stream-images.md) for workflow, limits and validation. The original Chyron animation and alpha export features remain available in the **Chyron** tab.

## What’s new in 2.2

- Material 3 typography roles with 12/14/16/22/24 px text and 48 px interaction targets. Inter stays the interface typeface.
- Twelve collapsible settings groups with live summaries, global settings search, expand/collapse controls, persistent panel state and per-group resets that work with undo.
- Templates open in a searchable modal; the timeline folds into a compact transport bar. Focus canvas hides the inspector when you need more room.
- Mobile and tablet layouts keep a preview above independently scrolling controls. On narrow screens, Design/Motion default to a labeled cropped detail view; the zoom button returns to the full canvas. Canvas settings and focus mode show the complete frame. Preview zoom never changes exported pixels.
- Editable 3/6-digit HEX colors, letter case, typography tracking, text-only subtitles, custom canvas dimensions with aspect lock/swap, composition rotation and group opacity.
- Improved keyboard behavior: native button activation, arrow-key tabs and export choices, modal focus return, and undo for deleted presets. Choosing a template retains canvas, timing and placement.
- The export action remains visible while format choices scroll. The portrait 720p default, shared 1-second intro/outro duration and transparent exports are retained.

See [UX/UI audit (Türkçe)](UX_UI_AUDIT.md) for findings, evidence, typography mapping and validation scope.

## Studio features

- A responsive studio interface with six starting templates, a live canvas, Design / Motion / Canvas controls, safe-area guides and a timeline.
- Tile and Typography modes in one editor. Ten bundled typefaces, seven typography effects, subtitle controls, palettes, rotation, depth, scatter and scale variation.
- New compositions default to the app's **720 × 1280 portrait canvas (720p)** at 30 fps. Other canvas presets remain available.
- Pop, Flip, Rise, Reveal, Typewriter and Soft fade animations, plus a still mode. Each outro reverses the intro's motion, easing and letter order.
- One **Animation duration** input controls both transitions and defaults to **1 second each**. Hold and stagger remain adjustable; the default clip is 1s intro + 2.4s hold + 1s outro.
- Preview intro or outro independently, or play the full clip with pause, restart, loop, scrub and frame stepping. Phase previews play once regardless of the loop setting. Space toggles playback; arrow keys move one frame. Animated exports start and end fully transparent.
- Autosave, grouped undo/redo, saved presets, portable `.chyron.json` projects and migration of legacy drafts and presets. A failed storage write is visible in the editor.
- A single deterministic renderer shared by preview and export. Rendering no longer waits for React or captures a responsive DOM layout.
- Export progress, cancellation, retry and download-again controls. The export uses an immutable project snapshot.

Saved projects retain their canvas dimensions. Earlier v2 projects with separate entrance/exit durations use their saved entrance length for the new shared duration. The portable project format remains version 2 and now stores `animationDuration`.

## Export formats

| Format             | Alpha                                       | Workflow                                                                                      |
| ------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| WebM / VP9         | Yes, `yuva420p`                             | OBS, overlays and compatible web players. Lossless VP9 encoding after 4:2:0 color conversion. |
| MOV / ProRes 4444  | Yes, `yuva444p10le`, 16-bit alpha component | Premiere, After Effects, Final Cut and compositing workflows.                                 |
| PNG sequence / ZIP | Yes, RGBA                                   | Lossless frame sequence, project JSON and import instructions.                                |
| PNG                | Yes, RGBA                                   | Full composition or selected playhead frame.                                                  |
| SVG                | Yes                                         | Standalone vector paths. No external fonts, `<text>` or `foreignObject`.                      |

All formats exclude the preview background and safe-area guides. A deliberately enabled **Soft dark backdrop** is part of the artwork and is included. Still exports default to the settled composition; select the current-frame checkbox to export the exact playhead frame instead.

Video exports are capped at **2,073,600 pixels per frame and 600 frames** to keep browser memory usage practical. Full HD landscape, Full HD portrait, 24/30/60 fps and shorter square videos are supported. Larger canvases, including 4K, can be exported as PNG sequences or stills. Encoding speed depends on the device; it is not real-time screen recording.

The video encoder is a single-threaded FFmpeg WebAssembly worker, loaded from the same origin on first use (about 32 MB). No server, upload, runtime CDN or cross-origin isolation headers are required. Cancellation terminates the worker; every subsequent job gets a fresh encoder. VP9 uses the `good` deadline because the realtime/lossless combination failed the browser export regression checks.

The old `webm-writer` pipeline was removed: its canvas/WebP alpha conversion can clamp fully transparent and opaque values. Tests decode the new video files and inspect their alpha planes rather than relying on container metadata.

Canvas input is 8-bit RGBA. ProRes' higher-bit-depth storage does not create extra source precision. VP9 preserves alpha but uses 4:2:0 color; PNG sequences preserve the original RGBA pixels. A player that cannot composite alpha may display a black background even when the file is correct.

To convert a PNG sequence with native FFmpeg:

```bash
ffmpeg -framerate 30 -i frame-%05d.png \
  -c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le \
  -alpha_bits 16 chyron-alpha.mov
```

Use the frame rate recorded in the ZIP's README, rather than assuming 30 fps.

## Verify

```bash
npm run check
npx playwright install chromium
npm run test:e2e
```

The browser suite requires native `ffmpeg` and `ffprobe` on PATH. It checks 720 × 1280 Flip exports as actual PNG, SVG, ZIP, VP9 and ProRes downloads, video duration/frame count, decoded alpha endpoints, opaque artwork and partial alpha, the shared duration input, intro/outro previews, editing, autosave, undo/redo, cancellation and mobile layout. `CHYRON_CHROMIUM_PATH` can point to a preinstalled Chromium binary in constrained environments.

The UX browser suite checks disclosure, search, numeric input, preset recovery, keyboard focus, seven viewport sizes, 200% text scaling and axe checks on the three inspector tabs, color controls, templates and export. It also decodes a 50%-opacity PNG to verify that opacity applies to the whole composition.

Unit tests cover new customization defaults and validation, preservation of user settings when applying a template, reversed intro/outro symmetry, long-text stagger completion, deterministic seeking, frame-boundary transparency at 24/30/60 fps, default dimensions/timing, legacy migration and malformed project imports. `npm run build` includes TypeScript checking.

Stream image tests verify the exact three PNG dimensions, decoded background/host pixels, transparent output, independent framing, drag/keyboard editing, failed-upload recovery, image persistence after reload, tool switching and responsive/accessibility checks. Synthetic images are used as test fixtures; no host photograph is bundled.

## Code map

- `src/studio/model.ts`: versioned project schema, validation, templates and legacy migration.
- `src/studio/motion.ts`: pure time-to-pose animation math.
- `src/studio/fonts.ts`: self-hosted font loading and glyph outlines.
- `src/studio/renderer.ts`: shared scene layout, canvas rendering and standalone SVG serialization.
- `src/studio/export.ts`: frame rendering, PNG/ZIP output and isolated FFmpeg encoding.
- `src/studio/useProject.ts`: history, persistence and presets.
- `src/studio/usePlayback.ts`: one cancellable animation clock.
- `src/components/`: composition preview, inspector, timeline and export dialog.
- `src/stream/`: Stream Images workspace, image loading, per-format composition, IndexedDB drafts and PNG/ZIP exports.

## Fonts and dependencies

Inter and display fonts are bundled via Fontsource; their license files ship in the respective npm packages. The existing Wicked Mouse font and its original license/readme have been retained. Check `public/assets/fonts/wicked_mouse/readme.txt` for the original font's usage terms. FFmpeg core is GPL-2.0-or-later; keep the relevant notices and comply with its license when distributing the application.

Useful upstream references: [FFmpeg codecs](https://ffmpeg.org/ffmpeg-codecs.html), [ffmpeg.wasm](https://ffmpegwasm.netlify.app/), [Fontsource](https://fontsource.org/).
