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
| Authentication and protected routes | Planned next |
| Customer Library and private Storage | Planned |
| Local background removal | Planned |
| Calibration page and optional PWA | Planned |

The `/login`, `/app/library`, and `/app/remove-background` screens currently show the intended interface but are not connected to Supabase or a background-removal model yet. Do not deploy this version as an authenticated production system until the authentication and database milestones are complete.

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

### 3. Crop and background

The crop dialog supports only the controls needed for ID printing:

- Drag to reposition.
- Zoom from 100% to 300%.
- Center the photo.
- Reset the crop.
- Choose **Fill frame** or **Whole photo**.

The same crop transform drives the on-screen preview and the PDF crop. Separate photos and crops can be used for the large and 1×1 sizes.

Photo background choices are:

- Original/transparent
- Pure white
- Light blue
- Custom color

Replacement colors show through transparent pixels. They cannot remove the existing background from an opaque JPG; use the Remove Background feature once that milestone is implemented, or provide an already-transparent PNG or WebP.

### 4. Cutting guides

Cutting borders can be enabled or disabled. Their color and thickness are adjustable. Shared and overlapping guide segments are merged before they are drawn in the PDF, avoiding doubled cut lines between adjacent photos.

The recommended default is the `0.25 pt` warm-gray hairline.

### 5. Download and print

**Download PDF** creates the print-ready file locally. **Print** opens the same generated PDF before invoking the browser print workflow. `Ctrl+P` uses this exact PDF path when the layout is valid.

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

## Architecture

- [Next.js](https://nextjs.org/) App Router and React
- TypeScript strict mode
- Tailwind CSS 4
- Browser Canvas for crop rasterization
- [`pdf-lib`](https://pdf-lib.js.org/) for exact client-side PDF generation
- Vitest for print-layout tests
- Lucide for interface icons
- Satoshi loaded through Fontshare's official API

The planned online data layer is Supabase Auth, PostgreSQL with Row Level Security, and private Supabase Storage. No service-role key may be exposed to the browser.

### Important directories

```text
src/
  app/                         Next.js routes and layouts
  components/                  Application shell and Template Builder UI
  lib/images/crop.ts           Canvas crop and background rendering
  lib/layout/                  Physical units, presets, and layout engines
  lib/pdf/photo-sheet.ts       Exact A4 PDF generation and cutting guides
public/assets/                 CJNET logo assets
docs/FONT-LICENSES.md          Font usage and licensing notes
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

Open [http://localhost:3000/app/template](http://localhost:3000/app/template).

### Verification commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Use `npm run test:watch` while changing the layout engine.

## Environment variables

No environment variables are needed for the current local Template Builder.

The supplied `.env.example` reserves the public Supabase variables needed by the authentication and Library milestones:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Never place a Supabase service-role key in a `NEXT_PUBLIC_*` variable or commit it to Git.

## Deployment

The application is designed for Vercel:

1. Import the GitHub repository into Vercel.
2. Keep the detected Next.js build settings.
3. Add the public Supabase environment variables after the Supabase milestone is implemented.
4. Deploy.

Until authentication is implemented, `/app/*` routes are not production-protected. Treat the current deployment as a development preview only.

## Fonts and offline behavior

Satoshi 400, 500, and 700 are loaded from Fontshare's official webfont API because its license restricts independently serving or redistributing the font binaries. See [`docs/FONT-LICENSES.md`](docs/FONT-LICENSES.md).

If Fontshare is unavailable, the interface falls back to Segoe UI and Arial. The Template Builder and PDF workflow do not depend on the UI font, but fully offline Satoshi would require separate written permission or a replacement font with a redistributable license.

## Known limitations

- Supabase authentication is not connected yet.
- `/app/*` routes are not protected yet.
- Customer records and private photo Storage are not implemented yet.
- The Remove Background screen does not run a model yet.
- Background replacement requires transparent pixels; it does not remove an opaque background.
- Temporary photos exist only in the current browser session and are not restored after a reload.
- The printable calibration page is still pending.

## Next milestone

Milestone 3 adds Supabase email/password authentication, active staff-profile checks, route protection, and secure session handling. After that, the Customer Library will add PostgreSQL records, Row Level Security, and private authenticated photo Storage.

## License

This repository does not currently declare an application source-code license. CJNET brand assets remain CJNET property. Third-party packages and fonts retain their respective licenses.
