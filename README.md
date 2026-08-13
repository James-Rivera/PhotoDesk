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
| Local background removal | Working; first model download requires internet |
| Admin maintenance | Working; admin-only health check and metadata export |
| Calibration page and optional PWA | Planned |

The `/login` screen is connected to Supabase email/password authentication. Customer Library supports private photos and direct Template Builder handoff. Remove Background now runs MediaPipe locally in the browser and can send its processed PNG to the Template Builder or private Customer Library.

## Template Builder

Open `/app/template` to use the current working feature.

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

**Download PDF** creates the print-ready file locally. The customer name is optional. Downloads use short unique names such as `James-Rivera_Normal_260813-174509.pdf`, or `CJNET_Normal_260813-174509.pdf` when the name is blank. **Print** opens the same generated PDF before invoking the browser print workflow. `Ctrl+P` uses this exact PDF path when the layout is valid.

For a dedicated shop folder, run the optional Windows helper and complete the one-time Brave setting described in [PDF download organization](docs/PDF-DOWNLOADS.md).

Before opening the print dialog, PhotoDesk shows the shop's Epson checklist: A4, Portrait, Actual Size / 100%, Epson Photo Quality Ink Jet paper, and Standard or High color quality. Web browsers cannot change Windows printer-driver options automatically. Use **Print using system dialog** (`Ctrl+Shift+P` in Chromium browsers), then open the Epson printer's **Preferences / Properties**. For the most predictable driver access, use **Download for Adobe Reader** and print the PDF from Adobe Acrobat Reader.

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

## Remove Background

Open `/app/remove-background`, upload or drop a JPG, PNG, or WebP portrait, and choose **Remove background**. The Apache-2.0 MediaPipe Selfie Segmenter runs on the staff computer. The model is downloaded on first use and cached by the browser; customer image pixels are not sent to an image-processing API.

The result can be previewed over a checkerboard and kept transparent, composited over pure white, light blue, soft gray, or any custom color. The chosen output can be downloaded as a PNG, sent directly to the Template Builder, or explicitly saved to the private Customer Library as a `processed` photo. Check hair, ears, and shoulders before printing because automatic segmentation is not perfect.

## Admin maintenance

Administrators have a **Maintenance** link below their staff profile. `/app/admin` checks authenticated database access, shows customer and photo-record counts, and exports non-secret customer/photo metadata as JSON. The export is useful for audits, but it is not a complete backup because it contains neither Auth users nor private Storage image bytes.

Full database and Storage recovery procedures are documented in [Admin maintenance and backups](docs/ADMIN-MAINTENANCE.md). Backup credentials must stay in the Supabase Dashboard or an administrator's terminal; they must never be added to browser code or `NEXT_PUBLIC_*` variables.

## Architecture

- [Next.js](https://nextjs.org/) App Router and React
- TypeScript strict mode
- Tailwind CSS 4
- Browser Canvas for crop rasterization
- Apache-2.0 MediaPipe Selfie Segmenter for local background removal
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
  lib/background-removal/      Replaceable local segmentation provider
  lib/layout/                  Physical units, presets, and layout engines
  lib/pdf/photo-sheet.ts       Exact A4 PDF generation and cutting guides
  lib/supabase/                Browser/server clients and session refresh
  lib/auth/                    Active staff checks and safe redirects
public/assets/                 CJNET logo assets
docs/FONT-LICENSES.md          Font usage and licensing notes
docs/SUPABASE-AUTH-SETUP.md    Authentication setup and first-admin guide
docs/ADMIN-MAINTENANCE.md      Backup and maintenance runbook
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

Copy `.env.example` to `.env.local` and provide the public Supabase configuration:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Never place a Supabase service-role key in a `NEXT_PUBLIC_*` variable or commit it to Git.

## Deployment

The application is designed for Vercel:

1. Import the GitHub repository into Vercel.
2. Keep the detected Next.js build settings.
3. Add the public Supabase environment variables from `.env.example`.
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
