# Incomplete work

This is the honest remaining-work list as of 2026-08-15. “Implemented” means the code path exists and passes local automated checks; it does not replace verification against CJNET's live Supabase project, printers, homelab, and real customer portraits.

## Required before production handoff

1. **Live Supabase verification.** Apply every migration to the production project, confirm the first admin, test staff login, and prove anonymous database and Storage requests are rejected.
2. **End-to-end Customer Library test.** Upload, view through a signed URL, send to Template Builder, rename, delete a photo, and delete a customer against the real private bucket.
3. **Background-removal quality test.** The constrained rembg container and public Cloudflare Tunnel route are deployed; public readiness, exact-origin CORS, blocked foreign-origin CORS, and unauthenticated rejection are verified. Set the production PhotoDesk environment value and try representative CJNET portraits—especially dark hair, white clothing, and busy backgrounds. Tune or replace the model only after a consistent shop-sample comparison.
4. **Printable calibration page.** Add and physically measure the required 1×1-inch, 2×2-inch, and 50×50-mm shapes at A4 / Actual Size / 100%.
5. **Printer acceptance test.** Verify cutting guides and exact dimensions on each Epson queue CJNET will use.
6. **Production deployment verification.** Configure Vercel, confirm environment variables, authentication redirects, homelab health/removal, PDF generation, and private photo access on the deployed origin.
7. **Backup rehearsal.** Create both a database dump and private Storage copy, then restore them into a separate Supabase project.

## Useful follow-up improvements

- Move full-resolution manual adjustment rendering into a Web Worker if representative workstation testing shows UI pauses on large photos.
- Add a small staff-only diagnostics view for homelab latency and model version after the production service is stable.
- Add explicit photo labels such as `normal attire` and `formal attire`; multiple photos work today, but `variant` currently only distinguishes `original` from `processed`.
- Let staff choose a customer's gallery cover instead of always showing the newest photo.
- Add a username-based sign-in flow only if CJNET wants usernames to replace email at login. The current username is display metadata; authentication still uses email/password.
- Add automated, server-side database and Storage backups in a trusted scheduled environment. The current admin download is metadata only.
- Add password recovery or keep account recovery as an administrator Dashboard procedure.
- Add the optional PWA shell after core printer and Supabase acceptance tests are stable.

## Deliberately out of scope

Generative retouching or Auto Fix, attire generation, CRM fields, analytics, subscriptions, public registration, and storing generated A4 PDFs in customer records remain intentionally excluded. Photo Preparation intentionally covers only background removal, edge repair, and basic deterministic color/Levels correction.
