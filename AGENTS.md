# CJNET PhotoDesk

## Product scope

CJNET PhotoDesk is a deliberately simple internal printing-shop application. Its primary workflow is **choose photo → choose preset → preview → download/print**. It accepts already-edited ID photos, arranges exact physical sizes on A4 photo paper, draws optional cutting guides, and produces an exact-dimension PDF. It also supports focused local background removal and a private reusable customer-photo library.

This is not Photoshop, a CRM, a public SaaS product, or a staff-management suite. Do not add advanced retouching, formal-attire generation, analytics, billing, subscriptions, public registration, or unrelated editing tools.

## Required routes

- `/login`
- `/app/template`
- `/app/remove-background`
- `/app/library`
- `/app/library/[customerId]`

All `/app/*` routes and private resources must require an authenticated, active staff profile once authentication is introduced in milestone 3. The shell has exactly three primary destinations: Template Builder, Remove Background, and Customer Library.

## Architecture

- Next.js App Router, TypeScript strict mode, Tailwind CSS.
- Browser-first image decoding, crop state, Canvas rendering, background removal, and `pdf-lib` PDF generation. Never proxy images through Vercel merely to resize or arrange them.
- `src/lib/layout/` contains pure, framework-independent physical layout calculations. PDF and Canvas adapters consume its output; they must not duplicate sizing math.
- Supabase Auth (email/password), PostgreSQL with RLS, and a private Storage bucket. Never ship a service-role key to the browser.
- Small React context for temporary image handoff between features; no Redux unless requirements materially change.
- Background removal lives behind a provider interface so the model can be replaced.
- Vercel-compatible; avoid server-only image-processing dependencies.
- Native printer-driver access is optional and isolated in `print-helper/`: a loopback-only C#/.NET Windows companion opens the system print dialog for an in-memory PDF. Keep browser printing and download fallbacks. Never add silent printing or network-bind the helper.

## Printing invariants

- A4 is exactly `595.28 × 841.89` PDF points.
- 1 inch is exactly 72 points; 1 mm is `72 / 25.4` points; 1 cm is `720 / 25.4` points.
- 2×2 is exactly `144 × 144` points; 1×1 is exactly `72 × 72` points.
- PDF page and placed-image dimensions come from point values, never CSS pixels, screenshots, browser print layout, or image DPI metadata.
- Pack from left to right and top to bottom inside explicit page margins and spacing. Report overflow; never silently shrink photos to fit.
- `CJNET Normal` is four 2×2 photos on its first row and six 1×1 photos on the next row, with thin cutting borders by default.
- Printed output instructions must say A4, Actual Size / 100%, with scaling disabled.
- The calibration page must contain exact 1×1-inch, 2×2-inch, and 50×50-mm shapes.

## Data and security invariants

- `profiles`: auth user id, full name, `admin | staff` role, active flag, created timestamp.
- `customers`: id, full name, optional notes, timestamps, creator.
- `photos`: id, customer id, private storage path, `original | processed` variant, original filename, MIME type, timestamp, creator.
- Store files at `customers/{customerId}/{photoId}/{filename}` in a private bucket.
- Use authenticated or short-lived signed access. RLS and Storage policies must enforce authentication; hidden UI is not authorization.
- Upload only after an explicit Save to Library action. Temporary work stays local.
- Confirm photo and customer deletion.

## Coding conventions

- Prefer Server Components; add `"use client"` only at interaction boundaries.
- Keep print math pure and deterministic. Use descriptive domain types and unit tests for every conversion/preset edge case.
- Components use clear shop-floor English, large targets, obvious progress/error/success states, and desktop-first responsive layouts.
- Use the global `FeedbackProvider` for confirmations and toast notifications. Never introduce native `window.confirm` or `window.alert`; destructive actions use the branded confirmation dialog and operational errors surface as error toasts.
- Keep dependencies minimal and license-check model/runtime dependencies before adding them.
- Do not commit secrets. `.env.example` documents public configuration only.
- Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` after each milestone; fix failures before continuing.

## Design system

- The supplied `Design system tokens extracted.zip` is the high-fidelity visual source of truth. Recreate it in the application; do not copy its prototype HTML into production.
- Core tokens live as CSS variables in `src/app/globals.css`: warm ground `#F5F1E8`, white surfaces, yellow action `#F4D400`, black ink `#171717`, warm neutral borders, green success, amber warning, and destructive-only red.
- Yellow means proceed, red means data loss, and green means success. The A4 sheet is the only square-cornered surface.
- Use the supplied CJNET logo assets verbatim. Do not ship the handoff's sample customer portrait.
- Follow the handoff's compact geometry: 240px sidebar, 56px top bar, 336px Builder controls, 72px action footer, 448×633px A4 preview, small radii, restrained shadows, and Lucide icons at stroke width 1.9.
- Load Satoshi weights 400/500/700 through Fontshare's official API. Its ITF Free Font License restricts redistributing or independently web-serving the font files, so do not commit copied Satoshi binaries without separate written permission. See `docs/FONT-LICENSES.md`.
- Keep the product brief's canonical `/app/*` route structure even where the HTML prototype uses shorter URLs.

## Milestones

1. Foundation and layout engine — Next.js shell, route skeleton, exact unit/layout primitives, presets, and tests.
2. Template Builder — image input/crop/preview, exact PDF generation, printing, reset and overflow UX.
3. Authentication — Supabase clients, email/password login, active-profile checks, protected routes.
4. Customer Library — migrations, RLS, private Storage, search, records/photos and feature handoff.
5. Background removal — researched/licensed local provider, progress, transparent/white outputs and handoff.
6. Verification/polish — full tests, calibration PDF/page, setup/deployment docs and end-to-end checks.
7. Optional PWA — only if it does not destabilize core printing.

## Milestone log

- 2026-08-12 — Milestone 1 completed from a clean repository. Added the Next.js 16 / React 19.2 / Tailwind CSS 4 foundation, all required route shells, a desktop-first navigation shell, pure point-based layout primitives, six preset definitions, a live CJNET Normal/2×2 Pair A4 preview, and seven layout tests. Vitest 3 is used because the current Windows/Node runtime rejected Vitest 4's Rolldown native binary. `test`, `typecheck`, `lint`, and the production build pass. Authentication and data access remain intentionally deferred until their milestones.
- 2026-08-12 — Integrated the supplied high-fidelity handoff tokens and CJNET logo assets into the foundation. Updated the login, app shell, Builder controls/preview/footer, and placeholder screens while preserving the exact point-based print engine and canonical routes. The sample customer photo remains excluded from production assets.
- 2026-08-12 — Milestone 2 completed. The Template Builder now loads JPG/PNG/WebP files locally (drag/drop or picker), validates type and 20 MB size, supports every preset plus configurable passport/custom measurements and quantities, reports/fixes overflow, previews separate crops/photos by size, exposes crop drag/zoom/fit controls, configures shared cutting guides, and generates/downloads/prints exact A4 PDFs through the MIT-licensed `pdf-lib`. Canvas rasterizes each unique crop at 300 DPI in the browser; the PDF reuses it at exact point dimensions. Reset is confirmed and Ctrl+P uses the exact PDF path. Nine tests plus typecheck, lint, and production build pass.
- 2026-08-12 — Connected Satoshi 400/500/700 through Fontshare's official webfont API and documented its ITF Free Font License. Font binaries are not self-hosted because the current license restricts independent font serving and redistribution.
- 2026-08-12 — Added replacement photo backgrounds (original/transparent, white, light blue, or a custom color) for transparent source images; preview and PDF Canvas rendering use the same background. Added mixed Passport + 1×1 quantities with a shelf packer that fills unused space beside passport rows before allocating new 1×1 rows, plus a calculated one-click fill-space offer and overflow recovery. Eleven tests pass, including mixed-row placement and maximum 1×1 capacity.
- 2026-08-12 — Restored shelf packing for adjustable CJNET Normal quantities. With five 2×2 photos, six existing 1×1 copies now sit beside the fifth photo instead of starting a wasteful new row, and the UI offers six more 1×1 copies to fill the 12-slot gap. Added regression coverage and browser position verification. Added the root README with operator and developer documentation.
- 2026-08-13 — Packaged the optional Windows print helper as a self-contained per-user NSIS setup executable. Staff workstations no longer need VS Code, Node.js, PowerShell scripts, or a .NET SDK; setup installs the helper, Start Menu and sign-in shortcuts, launches it, and includes a clean uninstaller. The ZIP remains a developer fallback.
- 2026-08-13 — Fixed production print-helper pairing by explicitly mapping the browser's lowercase JSON `code` field in the C# request contract. Embedded the supplied CJNET wordmark as the Windows executable, installer, shortcut, and tray icon.
- 2026-08-13 — Replaced WebView2's preview-less system print dialog with a focused CJNET print window: exact PDF preview, installed-printer selector, copies initialized to 1, direct Windows/Epson Printer Properties access, and one-page A4 direct printing at 100% scale. The browser and PDF fallbacks remain available.
- 2026-08-13 — Added the optional CJNET Windows Print Helper. The Vercel web app now detects and pairs with a loopback-only C#/.NET companion, sends the exact in-memory A4 PDF to it, and opens Windows' native print dialog so staff can use existing shared printers and their real Epson Preferences UI. Pairing uses an origin-bound local token; payloads are PDF-only and size-limited. Browser print and PDF download remain available. Added staff install/uninstall scripts, a self-contained ZIP publisher, security/setup documentation, and verified the localhost health/unauthorized-request boundary. Next.js tests/typecheck/lint/build and the helper build/publish pass; the official WebView2 package emits a non-fatal WindowsBase reference warning under .NET 10.
- 2026-08-13 — Milestone 5 implemented with Apache-2.0 MediaPipe Selfie Segmenter behind a replaceable provider. Added local JPG/PNG/WebP processing, progress and errors, checkerboard/white preview, PNG download, Template handoff, and explicit processed-photo Library saving. Added an admin-only maintenance route with authenticated health checks and metadata export, plus a separate database/Storage backup runbook. Automated checks pass; real-portrait quality acceptance, live Supabase security verification, calibration printing, and production deployment remain documented work.
- 2026-08-13 — Matched CJNET Normal to the shop's Photoshop reference PDF: the four exact 2×2 photos are centered using the maximum equal A4 edge allowance (9.64 pt, approximately 3.4 mm). Darkened and strengthened the default shared cutting guides to 0.5 pt medium gray for more reliable photo-printer output, while keeping thickness adjustable.
- 2026-08-13 — Added an Epson-focused pre-print checklist covering A4, Actual Size / 100%, Epson Photo Quality Ink Jet media, color quality, and access to Windows Printer Properties through the system dialog. The app still cannot silently change printer-driver settings; staff may download the exact PDF for Adobe Acrobat Reader when full driver controls are needed.
- 2026-08-13 — Added the dedicated `CJSERVER2` Epson photo-queue setup guide. Passport and mixed Passport + 1×1 layouts now use CJNET Normal's approximately 3.4 mm printer-safe A4 edge allowance and 0.5 pt medium-gray default cutting guides without changing configured photo dimensions or losing the 1×1 space beside five 35 mm passport photos.

- 2026-08-13 — Milestone 3 completed. Added Supabase SSR email/password login, safe cookie refresh through Next.js Proxy, server-side active-profile enforcement for all `/app/*` routes, staff identity/sign-out UI, a deny-by-default RLS `profiles` migration, first-administrator setup documentation, and redirect-safety tests. No service-role key is used or accepted by browser code.

- 2026-08-13 — Milestone 4 completed. Added searchable customer records, multiple private-photo uploads directly from the browser to Supabase Storage, signed thumbnails, rename/delete workflows with confirmation, active-staff RLS for customer/photo rows and Storage objects, and in-memory Library → Template Builder handoff. The private bucket is created and restricted by the second SQL migration.

- 2026-08-13 — Added explicit Template Builder → Customer Library saving. A newly loaded local photo prompts staff to save or dismiss; the save dialog can select an existing customer or create one, then uploads the original photo directly to private Storage. Nothing uploads automatically, and crops/A4 layouts remain local.

- 2026-08-13 — Changed Customer Library discovery to a visual gallery. Each customer card uses the newest private photo as a signed cover preview and shows the photo count; the detail record continues to retain every normal/formal/processed image under one customer.

- 2026-08-13 — Replaced the Windows Print Helper's Edge WebView2 PDF viewer and printing path with a native WinForms A4 preview and `PrintDocument` pipeline. PhotoDesk now prepares a matching 300-DPI `2480 × 3508` print sheet from the same point-based layout used by the exact PDF, while the helper validates the raster, compensates for driver hard margins, exposes the selected printer's real settings, and presents one clear Print action. Added browser unit coverage and a printer-free .NET simulation suite; the app checks, native build, ZIP, and NSIS setup package pass without WebView2 files.
- 2026-08-14 — Added database-backed login throttling (five attempts per staff email and 30 per network address per 15 minutes) plus throttled forgot-password requests. Password-help requests now send a server-side Resend notification to `jamescarlorivera52@gmail.com`; no account existence, email API key, raw email, or raw IP is exposed through the limiter.
- 2026-08-14 — Added a two-customer A4 workflow with independent Customer A and B photos and quantities, shared square cropping for CJNET Normal, and separate Passport and 1×1 crops where their aspect ratios differ. Updated the Customer Library and picker into date-filterable photo galleries with names revealed on hover or focus. The combined feature and authentication changes pass 30 tests, typecheck, lint, and the production build.
- 2026-08-14 — Added a second Template Builder mode for regular Photo Prints. Staff can queue unique local or Library photos at 3R, 4R, 5R, or custom physical sizes, select orientation and copies, keep an independent crop per photo, and print through the existing exact PDF/native A4 pipeline. A deterministic cut-friendly mixed-photo packer preserves exact dimensions and reports overflow without shrinking. Fixed desktop Builder scrolling so the document no longer moves; controls and preview scroll independently while the mode strip and print footer remain visible. All 34 tests, typecheck, lint, and the production build pass.
- 2026-08-14 — Expanded Photo Prints with Wallet, 2R, 6R, 8R, and exact CR80 (`85.60 × 53.98 mm`) choices alongside 3R, 4R, 5R, and Custom. Clarified the preview counter to distinguish queued photo items from physical prints so two one-copy photos read as two items and two prints rather than ambiguous “copies.” All 37 tests, typecheck, lint, and the production build pass.
- 2026-08-14 — Added live pending-size previews to Photo Prints. Selecting or editing a photo now packs its draft size, orientation, quantity, and crop directly into the A4 preview with a yellow dashed outline and not-added status. Overflowing drafts cannot be committed, and output remains disabled until the pending photo is explicitly added. Browser verification confirmed live 4R-to-CR80 resizing, one pending frame, independent workspace scrolling, and zero page scroll. All 37 tests, typecheck, lint, and the production build pass.
- 2026-08-14 — Aligned Photo Prints with CJNET shop terminology: CR80 is labeled Wallet ID at its exact `53.98 × 85.60 mm` card dimensions, `2 × 3 in` is Cute Size, and `2.5 × 3.5 in` is explicitly 2R Photo. These remain separate crop ratios so CR80 ID artwork is never forced into a 2R frame.
- 2026-08-15 — Replaced the insufficient MediaPipe production path with an authenticated, self-hosted rembg service designed for the CJNET homelab. The Photo Preparation workspace now supports computer or Library input, explicit service health/upload/cancel states, deterministic Exposure/Contrast/Levels/color/sharpness controls, manual erase/restore edge repair, transparent or replacement-color output, and Download/Library/Template handoff. Vercel never receives processing uploads, no service-role credential is used, no generative Auto Fix was added, and MediaPipe was removed from the frontend bundle. A live constrained homelab benchmark rejected BiRefNet Portrait after it saturated 3 GiB and caused swap growth; Apache-2.0 IS-Net General Use is the active quality-first candidate, with U2Net Human Seg as the faster fallback. Frontend tests, typecheck, lint, production build, service configuration, localhost binding, health, and unauthenticated rejection checks pass; real-portrait acceptance remains required.
- 2026-08-15 — Published the loopback-only homelab rembg service at `rembg.cloudavera.tech` through the existing outbound Cloudflare Tunnel so ordinary staff workstations do not require Tailscale. Cloudflare created a proxied CNAME to the healthy `homelab` tunnel; the container remains bound to `127.0.0.1:7000`, no inbound port was opened, and Tailscale Serve remains the private fallback. Public readiness, exact production-origin CORS, foreign-origin rejection, and pre-upload unauthenticated rejection were verified. Photo bytes now transit Cloudflare by explicit product decision; Vercel still does not receive them.
- 2026-08-15 — Moved Photo Preparation adjustments into a compact Photoshop-inspired dialog with a live RGB/luminance histogram, input and output Levels, a Color & Detail tab, Preview toggle, explicit Apply/Cancel semantics, reset, `Ctrl+L` where browser shortcut policy permits, reliable `A` fallback, and `Esc` cancellation. Its desktop title bar is draggable without dimming the live workspace photo; viewport bounds, a reset-position action, and session-only position memory keep it recoverable, while small screens remain centered. The desktop workspace is viewport-locked so the document no longer scrolls; the controls pane retains independent overflow only when necessary. Histogram sampling ignores transparent pixels and uses the same deterministic Canvas pipeline as output. Added histogram/output-level unit coverage; 44 tests, typecheck, lint, and the production build pass.
- 2026-08-15 — Added conservative Auto Levels beside the fully editable manual controls. It derives clipped luminance endpoints and a tightly bounded midpoint from visible pixels only, preserves color controls, and exposes every resulting value for review. Remove Background → Template Builder handoff now transfers an adjusted transparent PNG plus the selected replacement color as editable metadata; Template Builder initializes its background selector from that choice and can change it without another removal pass. Added empty/transparent and bounded-auto-level coverage; 46 tests pass.
- 2026-08-15 — Reworked Photo Preparation into a fitted image workspace for large source files. Original/prepared views now show the complete image at Fit with 50–300% zoom and scrollable inspection; Edit Edges uses the same bounded canvas model and keeps Cancel/Done visible beneath it. Background-removal work now presents a focused stage/percentage/cancel modal. Manual adjustment previews render immediately at a responsive workspace resolution while retaining the last completed frame, with full-resolution rendering still reserved for saved/downloaded/template output.
- 2026-08-15 — Replaced adjustment-preview Blob URL regeneration with a persistent, cached-bitmap Canvas that redraws on the next animation frame. Slider changes no longer reload the image element, flash between object URLs, or introduce an updating badge into the scroll layout. Added `docs/PRODUCTION-READINESS.md` with explicit Supabase, Vercel, Cloudflare/rembg, privacy, end-to-end, physical-print, backup, monitoring, GO/NO-GO, and rollback gates.
- 2026-08-18 — Fixed the Windows Print Helper leaking Epson photo media/quality choices into Word, browser PDF printing, and other applications. Removed the printer-wide `PrintUIEntry /e` preferences editor and replaced it with a job-local Windows `PageSetupDialog` backed by the current in-memory `PrintDocument`; PhotoDesk reapplies exact A4, portrait, simplex, color, and zero-margin page settings after the dialog. Updated staff-facing warnings, bumped the helper to 0.4.0, rebuilt the installer/ZIP, and passed the native simulations plus all 50 frontend tests, typecheck, lint, and production build.
- 2026-08-18 — Corrected the 0.4.0 print-settings regression in helper 0.4.1. The job-local `PageSetupDialog` successfully avoided global changes but did not expose the Epson driver's media/quality controls. Replaced it with the driver's real `DocumentProperties` modal using caller-owned `DM_IN_PROMPT | DM_IN_BUFFER | DM_OUT_BUFFER` `DEVMODE` data, preserving Photo Quality Ink Jet and other driver-private choices only in the active PhotoDesk `PrintDocument`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
