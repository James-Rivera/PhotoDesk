# CJNET PhotoDesk

CJNET PhotoDesk is a simple internal web application for preparing exact-size ID photo sheets on A4 photo paper. It replaces the shop's Photoshop-based layout workflow with a guided process:

**Choose photo → choose preset → adjust crop → preview → download or print**

The working Template Builder processes customer photos in the browser. Uploaded photos are not sent to an image-resizing server, and the application does not use image DPI metadata to determine print size.

## Current status

The project is being implemented in milestones.

| Area | Status |
| --- | --- |
| Application shell and print layout engine | Working |
| Template Builder | Working |
| Exact A4 PDF generation | Working |
| Authentication and protected routes | Working; Supabase project setup required |
| Customer Library and private Storage | Working; migration setup required |
| Homelab background removal and photo preparation | Working; private service deployment required |
| Admin maintenance | Working; admin-only health check and metadata export |
| Calibration page and optional PWA | Planned |

The `/login` screen is connected to Supabase email/password authentication. Customer Library supports private photos and direct Template Builder handoff. Photo Preparation sends an authenticated portrait directly from the browser to CJNET's private rembg service, then keeps manual color correction, background composition, download, and feature handoff in the browser.

## Template Builder

Open `/app/template` to use the current working feature. The mode switch at the top keeps the existing **ID Photos** workflow as the usual default and provides a separate **Photo Prints** workflow for regular photo sizes.

### Photo Prints mode

Photo Prints lets staff combine different source photos and physical sizes on one A4 sheet without manually positioning rectangles:

1. Add a JPG, PNG, or WebP from the computer or private Customer Library.
2. Choose CR80 / Wallet ID (`53.98 × 85.60 mm`), Cute Size (`2 × 3 in`), 2R Photo (`2.5 × 3.5 in`), 3R (`3.5 × 5 in`), 4R (`4 × 6 in`), 5R (`5 × 7 in`), 6R (`6 × 8 in`), 8R (`8 × 10 in`), or a custom size in inches, millimeters, or centimeters.
3. Choose portrait or landscape, set copies, and adjust the independent crop.
4. Add the photo to the A4 sheet and repeat for other photos.

As soon as a photo and size are selected, the A4 preview includes the pending print at its exact proportion and packed position. A yellow dashed outline and **not added yet** status distinguish this live draft from committed photo items. Size, orientation, quantity, and crop changes update it immediately. If the draft would overflow A4, PhotoDesk explains how many prints do not fit and disables **Add to A4 sheet** until the selection is corrected. Download and Print also remain disabled while a draft is waiting to be added.

The cut-friendly mixed-photo packer considers larger photos first, then places exact-size rectangles from left to right and top to bottom. It never rotates, shrinks, or omits a requested print. Jobs with copies that do not fit are marked and printing stays disabled until staff edit or remove them. The queue stays in browser memory unless **Save photo to Library** is explicitly selected.

The preview summary distinguishes **photo items** from physical **prints**. Two photo items set to one copy each produce two prints; increasing either item to two copies increases the print total accordingly.

On desktop, the top mode switch and bottom print bar stay visible. The controls and A4 preview scroll independently, preventing the browser-level scrolling that previously shifted the entire Builder workspace.

### 1. Choose a photo

- Drag a JPG, PNG, or WebP image into the upload area, or click it to browse.
- The maximum file size is 20 MB.
- The file is decoded locally and kept in browser memory.
- Selecting a new main photo resets its crop.

### 2. Choose a layout

Available presets:

- **CJNET Normal:** four 2×2-inch photos followed by six 1×1-inch photos.
- **2×2 Pair:** two 2×2-inch photos.
- **2×2 Only:** adjustable quantity.
- **1×1 Only:** adjustable quantity.
- **Passport:** configurable width and height in millimeters, with optional 1×1 copies.
- **Custom:** configurable width, height, unit, quantity, spacing, and page margin.

The layout engine places photos from left to right and top to bottom. It never shrinks a photo to hide an overflow. When copies do not fit, downloading and printing are disabled and the interface offers a valid reduced quantity.

### Mixed Passport and 1×1 sheets

Passport mode uses a mixed shelf-packing algorithm:

1. Passport photos are placed in rows.
2. 1×1 photos fill unused width beside partially filled passport rows.
3. Remaining 1×1 photos continue on their own rows.

The yellow **Use the empty paper** suggestion calculates the remaining 1×1 capacity for the current passport dimensions and fills it with one click. Changing the passport dimensions recalculates the capacity automatically.

Passport sheets use the same approximately 3.4 mm printer-safe A4 edge allowance and shared 0.5 pt medium-gray cutting guides as CJNET Normal. This still leaves room for a 1×1 photo beside five 35 mm-wide passport photos. Photo width and height remain exactly equal to the configured millimeter values.

### 3. Crop and background

The crop dialog supports only the controls needed for ID printing:

- Drag to reposition.
- Zoom from 100% to 300%.
- Center the photo.
- Reset the crop.
- Choose **Fill frame** or **Whole photo**.

The same crop transform drives the on-screen preview and the PDF crop. When **Use same photo for all sizes** is enabled, both the image and main crop are shared by the large and 1×1 copies. Disable it to choose and crop the 1×1 photo separately.

Photo background choices are:

- Original/transparent
- Pure white
- Light blue
- Custom color

Replacement colors show through transparent pixels. They cannot remove the existing background from an opaque JPG; use the Remove Background page first, or provide an already-transparent PNG or WebP.

### 4. Cutting guides

Cutting borders can be enabled or disabled. Their color and thickness are adjustable. Shared and overlapping guide segments are merged before they are drawn in the PDF, avoiding doubled cut lines between adjacent photos.

The recommended default is a medium-gray `0.5 pt` line so ordinary photo printers reproduce every guide reliably. `CJNET Normal` centers its four exact 2×2 photos with approximately `3.4 mm` of space on each A4 edge—the largest equal left/right allowance possible without shrinking the photos. This matches the geometry measured from the shop's established Photoshop template.

### 5. Download and print

**Download PDF** creates the exact-dimension print file locally. The customer name is optional. Downloads use short unique names such as `James-Rivera_Normal_260813-174509.pdf`, or `CJNET_Normal_260813-174509.pdf` when the name is blank. **Print** prepares a matching 300-DPI A4 sheet for the native Windows helper. `Ctrl+P` follows the same Print workflow when the layout is valid.

For a dedicated shop folder, run the optional Windows helper and complete the one-time Brave setting described in [PDF download organization](docs/PDF-DOWNLOADS.md).

Before opening the Windows helper, PhotoDesk shows the shop's Epson checklist: A4, Portrait, Actual Size / 100%, Epson Photo Quality Ink Jet paper, and Standard or High color quality. The helper opens the selected printer's real Windows settings because paper media and photo quality remain driver-specific. Adobe Acrobat Reader and browser printing remain fallback paths for the exact PDF.

For the normal staff workflow, run `CJNET-Print-Helper-Setup.exe` once per workstation as described in [CJNET Windows Print Helper](docs/WINDOWS-PRINT-HELPER.md). Staff do not need VS Code or developer tools. PhotoDesk opens a native helper window with the A4 preview, a printer selector, copies defaulted to 1, direct Printer settings, and one clear Print button. The helper does not use Edge or WebView2. Browser printing and PDF download remain fallbacks.

For the recommended one-choice shop workflow, see [Epson photo queue setup](docs/EPSON-PHOTO-QUEUE-SETUP.md).

Always print with:

- Paper size: **A4**
- Scale: **Actual Size / 100%**
- Fit to page: **Off**

> Huwag piliin ang “Fit to page” — mababawasan ang sukat.

## Exact print dimensions

All print geometry uses PDF points:

| Measurement | PDF points |
| --- | ---: |
| A4 width | 595.28 |
| A4 height | 841.89 |
| 1 inch | 72 |
| 1 millimeter | `72 / 25.4` |
| 2×2 photo | 144 × 144 |
| 1×1 photo | 72 × 72 |

The browser preview may be visually zoomed between 50% and 150%, but preview zoom never affects PDF dimensions. Images are rasterized for their target cells at 300 DPI, then placed at exact point dimensions with `pdf-lib`.

## Customer Library

Authenticated active staff can create, search, rename, and delete customer records; upload multiple JPG, PNG, or WebP photos; and reuse a saved photo in the Template Builder. The main Library is a visual customer gallery: each card uses the newest saved photo as its cover and shows the total photo count. Opening the customer still shows every saved version, so normal-attire and formal-attire photos remain together. Files upload directly from the browser to the private `customer-photos` Supabase bucket. Vercel does not receive or transform the image body.

Inside the Template Builder, **Choose from Customer Library** opens a searchable private-photo picker. Selecting a photo loads it directly into the current sheet without navigating through the customer-detail page.

Thumbnails use one-hour signed URLs. Database and Storage RLS grant access only to active staff, and destructive actions require confirmation. The handoff to Template Builder downloads the authorized private object into temporary browser memory; it does not create another Storage copy.

After a local photo is added to the Template Builder, PhotoDesk offers an optional **Save to Library** prompt. Staff can choose an existing customer or create a new customer in place. Only an explicit confirmation uploads the original source photo; the crop and A4 layout remain temporary and local.

## Photo Preparation / Remove Background

Open `/app/remove-background`, upload or choose a Library JPG, PNG, or WebP portrait, and choose **Remove background**. The browser uploads through `https://rembg.cloudavera.tech` and the existing outbound-only Cloudflare Tunnel to CJNET's authenticated homelab rembg service; Vercel never receives the photo body. Cloudflare transports the request, while the origin remains bound to homelab loopback. The service validates the staff member's existing Supabase session and active profile, runs the fixed `isnet-general-use` model in memory, and returns a transparent PNG without retaining the upload.

The workspace includes a compact Photoshop-inspired adjustment dialog with a live RGB/luminance histogram, input/output Levels, and deterministic manual Exposure, Contrast, Warmth, Tint, Saturation, and Sharpness controls. **Auto** applies conservative histogram-based input Levels with tightly bounded midpoint correction; it does not alter color, hide its values, or prevent further manual editing. On desktop, drag the dialog title bar to keep the portrait visible; the position is remembered for the browser session, remains constrained to the viewport, and can be restored by double-clicking the title bar or using its reset-position button. Small screens keep the dialog centered. `Ctrl+L` opens Levels when the browser permits overriding that reserved address-bar shortcut; `A` is the reliable fallback, and `Esc` cancels. The Preview checkbox redraws a persistent Canvas on the next animation frame as controls move, avoiding image reload flicker and layout scrollbar changes; Cancel restores the previous values and Apply commits the draft. The main workspace fits the entire image by default and provides 50–300% zoom with scrollable inspection. Background removal uses a focused progress dialog with live stage, percentage, and cancellation. After removal, **Edit edges** provides the same fit/zoom model, brush-based erase, restore, undo, and reset for hair, ears, and clothing, with its Done action fixed below the canvas. The result can stay transparent or use white, light blue, soft gray, or a custom color, then be downloaded, sent to Template Builder, or explicitly saved to the private Customer Library as `processed`. Template handoff keeps the prepared PNG transparent and carries the current color only as an editable starting choice, so staff can change the background in Template Builder without removing it again.

Deploy and secure the service using [`services/rembg/README.md`](services/rembg/README.md), then set `NEXT_PUBLIC_BACKGROUND_REMOVAL_API_URL=https://rembg.cloudavera.tech`. If the homelab, its Internet connection, or the tunnel is offline, manual preparation and output remain available, but background removal is disabled with an explicit health status.

## Admin maintenance

Administrators have a **Maintenance** link below their staff profile. `/app/admin` checks authenticated database access, shows customer and photo-record counts, and exports non-secret customer/photo metadata as JSON. The export is useful for audits, but it is not a complete backup because it contains neither Auth users nor private Storage image bytes.

Full database and Storage recovery procedures are documented in [Admin maintenance and backups](docs/ADMIN-MAINTENANCE.md). Backup credentials must stay in the Supabase Dashboard or an administrator's terminal; they must never be added to browser code or `NEXT_PUBLIC_*` variables.

## Architecture

- [Next.js](https://nextjs.org/) App Router and React
- TypeScript strict mode
- Tailwind CSS 4
- Browser Canvas for crop rasterization
- MIT-licensed rembg with Apache-2.0 IS-Net General Use on the private homelab service
- [`pdf-lib`](https://pdf-lib.js.org/) for exact client-side PDF generation
- Supabase Auth with cookie-based server rendering and RLS-protected staff profiles
- Vitest for print-layout and redirect-safety tests
- Lucide for interface icons
- Satoshi loaded through Fontshare's official API

The online data layer uses Supabase Auth and PostgreSQL Row Level Security. Private Supabase Storage arrives with the Customer Library milestone. No service-role key may be exposed to the browser.

### Important directories

```text
src/
  app/                         Next.js routes and layouts
  components/                  Application shell and Template Builder UI
  lib/images/crop.ts           Canvas crop and background rendering
  lib/background-removal/      Replaceable authenticated segmentation provider
  lib/layout/                  Physical units, presets, and layout engines
  lib/pdf/photo-sheet.ts       Exact A4 PDF generation and cutting guides
  lib/supabase/                Browser/server clients and session refresh
  lib/auth/                    Active staff checks and safe redirects
public/assets/                 CJNET logo assets
docs/FONT-LICENSES.md          Font usage and licensing notes
docs/SUPABASE-AUTH-SETUP.md    Authentication setup and first-admin guide
docs/ADMIN-MAINTENANCE.md      Backup and maintenance runbook
docs/PRODUCTION-READINESS.md   Production release gates, smoke tests, and rollback
docs/INCOMPLETE-WORK.md        Honest remaining-work checklist
supabase/migrations/           Database schema and RLS migrations
AGENTS.md                      Product, architecture, and implementation rules
```

The layout modules are pure TypeScript. The preview and PDF generator consume their results instead of maintaining separate sizing logic.

## Local development

### Requirements

- Node.js 20.9 or newer
- npm

### Install and run

```bash
npm install
npm run dev
```

Configure Supabase as described in [Supabase authentication setup](docs/SUPABASE-AUTH-SETUP.md), then open [http://localhost:3000/app/template](http://localhost:3000/app/template).

### Verification commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Use `npm run test:watch` while changing the layout engine.

## Environment variables

Copy `.env.example` to `.env.local` and provide the Supabase and server-only security configuration:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
AUTH_RATE_LIMIT_SECRET=
RESEND_API_KEY=
PASSWORD_HELP_FROM_EMAIL=CJNET PhotoDesk <password-help@your-verified-domain.example>
PASSWORD_HELP_ADMIN_EMAIL=jamescarlorivera52@gmail.com
```

Never place a Supabase service-role key or any server-only secret in a `NEXT_PUBLIC_*` variable or commit it to Git. See [Supabase authentication setup](docs/SUPABASE-AUTH-SETUP.md) for the rate-limit migration and Resend configuration.

## Deployment

The application is designed for Vercel:

1. Import the GitHub repository into Vercel.
2. Keep the detected Next.js build settings.
3. Add all environment variables from `.env.example`, keeping the rate-limit and email values server-only.
4. Deploy.

Apply the database migration and create the first active administrator before staff use. See [Supabase authentication setup](docs/SUPABASE-AUTH-SETUP.md).

## Fonts and offline behavior

Satoshi 400, 500, and 700 are loaded from Fontshare's official webfont API because its license restricts independently serving or redistributing the font binaries. See [`docs/FONT-LICENSES.md`](docs/FONT-LICENSES.md).

If Fontshare is unavailable, the interface falls back to Segoe UI and Arial. The Template Builder and PDF workflow do not depend on the UI font, but fully offline Satoshi would require separate written permission or a replacement font with a redistributable license.

## Known limitations

- Background removal is optimized for a single prominent person and may need an edited source when hair or clothing blends into the backdrop.
- Initial background-model and WebAssembly loading requires internet. Processing occurs on the main browser thread and can briefly use substantial CPU/GPU on older shop computers.
- Temporary photos exist only in the current browser session and are not restored after a reload.
- The admin JSON export is metadata only; complete database, Auth, and private Storage recovery remains an operator procedure.
- The printable calibration page is still pending.
- Optional PWA/offline installation is still pending.

See [Incomplete work](docs/INCOMPLETE-WORK.md) for the complete prioritized list.

## License

This repository does not currently declare an application source-code license. CJNET brand assets remain CJNET property. Third-party packages and fonts retain their respective licenses.
