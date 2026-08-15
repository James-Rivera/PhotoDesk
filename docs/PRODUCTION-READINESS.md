# Production readiness runbook

Use this document to promote CJNET PhotoDesk to `https://photodesk.cloudavera.tech`. It is a release gate, not a claim that production acceptance has already happened. Do not mark the release **GO** until every required checkbox is completed against the real Supabase project, homelab, Cloudflare Tunnel, Vercel deployment, and shop printers.

## Release ownership

- Release owner: ____________________
- Release commit/tag: ____________________
- Planned release time: ____________________
- Rollback owner: ____________________
- Supabase backup location: ____________________
- Storage backup location: ____________________

## 1. Freeze and verify the release candidate

- [ ] Work from the intended production branch with no unexplained local changes.
- [ ] Confirm Node.js is 20.9 or newer.
- [ ] Run `npm ci` from the repository root.
- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm audit --omit=dev` and review every production finding.
- [ ] Record the exact commit or tag above. Deploy that immutable revision.

Any failed check is a release blocker. Do not deploy from a workstation-only patch that is not committed and recoverable.

## 2. Supabase production setup

Apply every migration in filename order and retain the migration output:

1. `202608130001_profiles_and_staff_auth.sql`
2. `202608130002_customer_library.sql`
3. `202608130003_profile_usernames.sql`
4. `202608130004_assign_first_admin.sql`
5. `202608140001_auth_rate_limits.sql`

- [ ] Take a database dump before applying migrations.
- [ ] Copy the private `customer-photos` bucket before schema/policy changes.
- [ ] Confirm the bucket remains private.
- [ ] Confirm the first administrator is active and has the `admin` role.
- [ ] Confirm normal staff profiles use the `staff` role and only current employees are active.
- [ ] Verify anonymous reads/writes fail for `profiles`, `customers`, `photos`, and Storage.
- [ ] Verify an inactive authenticated user cannot open `/app/*` or access private rows/objects.
- [ ] Verify ordinary active staff cannot open `/app/admin`.
- [ ] Verify a raw Storage object URL without a signed token does not load.
- [ ] Rehearse a database and Storage restore into a separate Supabase project.

Follow [Supabase authentication setup](SUPABASE-AUTH-SETUP.md) and [Admin maintenance and backups](ADMIN-MAINTENANCE.md). Never put a service-role key in PhotoDesk, Vercel browser variables, or the rembg service.

## 3. Production environment variables

Configure these in Vercel Production and redeploy after any change:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
NEXT_PUBLIC_BACKGROUND_REMOVAL_API_URL=https://rembg.cloudavera.tech
AUTH_RATE_LIMIT_SECRET=LONG_STABLE_RANDOM_VALUE
RESEND_API_KEY=SERVER_ONLY_RESEND_KEY
PASSWORD_HELP_FROM_EMAIL=CJNET PhotoDesk <password-help@YOUR_VERIFIED_DOMAIN>
PASSWORD_HELP_ADMIN_EMAIL=jamescarlorivera52@gmail.com
```

- [ ] Use the Supabase publishable key; use the legacy anon key only as the documented fallback.
- [ ] Confirm `AUTH_RATE_LIMIT_SECRET` is unique, at least 32 characters, server-only, and stable across deployments.
- [ ] Confirm the Resend sending domain is verified and the From address matches it.
- [ ] Inspect the Vercel build/runtime environment and browser bundle for accidental secrets.
- [ ] Confirm Preview and Development values do not point at production data unless intentionally approved.

## 4. Homelab rembg service and Cloudflare Tunnel

- [ ] Deploy `services/rembg` using its checked-in Compose configuration and a private `.env` file.
- [ ] Confirm the service binds only to `127.0.0.1:7000`; do not open a router or firewall port.
- [ ] Confirm the Cloudflare Tunnel maps `rembg.cloudavera.tech` to `http://127.0.0.1:7000`.
- [ ] Confirm `/health/live` responds and `/health/ready` reports the expected fixed model.
- [ ] Confirm `ALLOWED_ORIGINS` includes the exact production origin `https://photodesk.cloudavera.tech` and only explicitly trusted development origins.
- [ ] Confirm an unauthenticated removal request is rejected before its body is processed.
- [ ] Confirm a valid active-staff Supabase token succeeds.
- [ ] Confirm a foreign Origin fails CORS.
- [ ] Confirm responses use `Cache-Control: no-store` and photo/request bodies are absent from application, proxy, and Cloudflare logs.
- [ ] Confirm container limits, persistent model volume, restart policy, disk space, memory, and swap are healthy.
- [ ] Test dark hair, light/white clothing, glasses, ears, shoulders, and busy backgrounds with approved non-customer or consented shop samples.
- [ ] Confirm the edge editor provides an acceptable manual recovery path.

The active `isnet-general-use` model is quality-first and CPU processing may take several seconds. The UI must show progress rather than imply that the browser has frozen. Follow [`services/rembg/README.md`](../services/rembg/README.md) and [Background-removal dependency review](BACKGROUND-REMOVAL-RESEARCH.md).

## 5. Vercel and domain verification

- [ ] Deploy the recorded release revision to Vercel Production.
- [ ] Confirm `photodesk.cloudavera.tech` resolves to the intended Vercel project with valid TLS.
- [ ] Confirm `/login` loads and all `/app/*` routes redirect signed-out users to login.
- [ ] Confirm authenticated navigation uses only Template Builder, Remove Background, and Customer Library as primary destinations.
- [ ] Confirm no customer photo request is proxied through Vercel for resizing, arrangement, or background removal.
- [ ] Confirm security-sensitive responses and private signed URLs are not cached publicly.
- [ ] Confirm the production app reaches `https://rembg.cloudavera.tech` from a workstation without Tailscale.
- [ ] Confirm the browser console and Vercel logs contain no secrets, photo bytes, unexpected stack traces, or repeated failed requests.

## 6. End-to-end shop acceptance

Test in a clean browser session on at least one actual staff workstation:

- [ ] Login succeeds for an active staff account and fails generically for invalid/inactive accounts.
- [ ] Login throttling and password-help throttling behave as documented.
- [ ] Password-help email arrives at the configured administrator address without revealing whether an account exists.
- [ ] Create, search, rename, and delete a test customer using branded confirmations.
- [ ] Upload a private photo, reload its signed preview, and send it to Template Builder.
- [ ] Remove a background, cancel one in-progress job, and complete another.
- [ ] Inspect and repair edges; verify the entire photo fits and zoom/scroll behave correctly.
- [ ] Apply Manual and Auto Levels; verify live preview, Cancel restoration, Apply, and Reset.
- [ ] Choose transparent, white, blue, gray, and custom backgrounds.
- [ ] Send the transparent cutout to Template Builder and change its background there without reprocessing.
- [ ] Download a processed PNG and verify its alpha/background and full-resolution dimensions.
- [ ] Save a processed photo explicitly to the private Library; confirm nothing uploads without that action.
- [ ] Generate every required ID preset and representative Photo Print sizes.
- [ ] Verify overflow is reported and photos are never silently shrunk.
- [ ] Download and open the exact A4 PDF.
- [ ] Test browser printing and the optional Windows Print Helper fallback.

## 7. Physical print acceptance

This is a hard production gate because browser preview accuracy does not prove physical size.

- [ ] Add/generate the required calibration page containing exact 1×1-inch, 2×2-inch, and 50×50-mm shapes.
- [ ] Print on A4 using **Actual Size / 100%** with scaling disabled.
- [ ] Measure every calibration shape with a physical ruler.
- [ ] Verify `CJNET Normal` prints four exact 2×2 photos and six exact 1×1 photos with the approved approximately 3.4 mm edge allowance.
- [ ] Verify 0.5 pt shared cutting guides are visible but not overly heavy.
- [ ] Repeat acceptance for every Epson printer/queue used by the shop.
- [ ] Record printer name, driver version, media setting, result, and approver.

Follow [Epson photo queue setup](EPSON-PHOTO-QUEUE-SETUP.md) and [Windows Print Helper](WINDOWS-PRINT-HELPER.md).

## 8. Monitoring and operating checks

Daily during initial rollout:

- [ ] Open `/app/admin` and confirm database health.
- [ ] Check Vercel errors and latency without logging customer content.
- [ ] Check Cloudflare Tunnel health and unexpected request volume.
- [ ] Check rembg container health, restarts, memory, swap, disk, and queue saturation.
- [ ] Confirm one real background-removal job completes from a non-Tailscale staff workstation.

Weekly after stabilization:

- [ ] Review active staff access.
- [ ] Download the admin metadata export for audit use.
- [ ] Confirm database and Storage backups completed together.
- [ ] Review failed login/removal patterns without exposing raw emails, IP addresses, or image content.

## 9. Rollback plan

Trigger rollback for authentication bypass, private-data exposure, corrupt/missing Library data, incorrect physical print dimensions, repeated client crashes, or an unusable background-removal path.

1. Stop new staff work and record the incident time.
2. Roll Vercel back to the last accepted deployment.
3. If rembg is responsible, disable its public Tunnel route or restore the last known-good container image/config; the rest of PhotoDesk remains usable without removal.
4. Do not reverse database migrations blindly. Restore into a separate project first, compare data, then choose a reviewed forward fix or controlled restore.
5. Preserve logs that do not contain photo bytes or secrets and document affected customer records.
6. Repeat the relevant security, data, and physical-print acceptance gates before reopening.

## Final GO / NO-GO

The release is **NO-GO** while any item below is unresolved:

- [ ] Automated checks and production build pass from the recorded revision.
- [ ] Production Supabase migrations, RLS, Auth, and private Storage are verified.
- [ ] Database and Storage backups have a successful restore rehearsal.
- [ ] Production domain, environment variables, email, and authentication are verified.
- [ ] Public rembg access works without Tailscale and passes authentication/CORS/privacy checks.
- [ ] Representative portrait quality is accepted by CJNET staff.
- [ ] Calibration and every production printer pass physical measurement.
- [ ] End-to-end Library → Preparation → Template → PDF/print workflow passes.
- [ ] Release and rollback owners approve the recorded revision.

Approval:

- Product/shop owner: ____________________ Date: __________
- Technical owner: _______________________ Date: __________
- Final decision: **GO / NO-GO**
