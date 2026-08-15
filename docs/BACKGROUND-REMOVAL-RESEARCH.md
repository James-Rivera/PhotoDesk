# Background-removal dependency review

Originally reviewed on 2026-08-13 and updated on 2026-08-15 for CJNET's commercial, private internal use.

## Rejected: `@imgly/background-removal`

IMG.LY's browser library is technically convenient and processes images locally, but its free license is AGPL-3.0. Using it in a private proprietary application would require a deliberate AGPL compliance decision or a separate commercial license. PhotoDesk does not include it.

## Rejected for now: `@huggingface/transformers` 4.2.0 + MODNet

The runtime and `onnx-community/modnet-webnn` model are labeled Apache-2.0 and offer a clean browser pipeline. A production `npm audit`, however, reported four unresolved high-severity vulnerabilities in mandatory Node dependencies pulled into the package (`onnxruntime-node`/`adm-zip` and bundled `sharp`). The dependency was immediately removed; a follow-up production audit returned zero vulnerabilities.

## Replaced: MediaPipe Image Segmenter

PhotoDesk initially used `@mediapipe/tasks-vision` 0.10.35 and Google's selfie-segmentation model. Its Apache-2.0 license and on-device privacy were suitable, but shop feedback found its portrait edges insufficiently accurate. The active workspace no longer depends on MediaPipe.

## Selected: private rembg service with IS-Net General Use

The active provider uses MIT-licensed `rembg` with Apache-2.0 `isnet-general-use` from the official DIS project. The service is self-hosted on CJNET's homelab so its inference runtime and model do not enlarge or constrain the Vercel application.

The 2026-08-15 homelab benchmark used one 1200 × 1500 synthetic non-customer image under two CPU, 3 GiB memory, and 256 PID limits. `isnet-general-use` completed inference in 10.516 seconds with 1,473.7 MiB peak RSS. `u2net_human_seg` completed in 4.486 seconds with 1,167.7 MiB peak RSS and remains the faster fallback. `birefnet-portrait` saturated the 3 GiB limit and caused approximately 1 GiB of host swap growth, so it was rejected for this 7.6 GiB homelab. These measurements prove capacity only; representative shop portraits must decide edge quality.

Photo bytes travel from the authenticated browser through `rembg.cloudavera.tech` on the existing Cloudflare Tunnel to the homelab service. Cloudflare therefore transports the image bytes, but Vercel does not receive them and the homelab origin remains bound to `127.0.0.1:7000` with no inbound port opened. Tailscale Serve remains the private administration/fallback path. The service validates the Supabase access token and the existing `is_active_staff()` database check, accepts no arbitrary URLs or client-selected model, authenticates and rate-limits before parsing the upload body, processes bytes in memory, and returns `Cache-Control: no-store`. No service-role key is present in either browser or service configuration.

The first container start downloads model weights to a persistent Docker volume. Production CORS is restricted to exact PhotoDesk origins, Cloudflare provides public TLS over the outbound tunnel, and request-body logging must remain disabled. Real shop portraits remain the acceptance criterion; automatic segmentation is never assumed perfect.

## Implementation rule

The engine remains behind `BackgroundRemovalProvider` and returns a transparent PNG blob with visible connection/upload/processing progress and cancellation. The page depends on this interface rather than rembg's API so the model or host can be replaced later. Basic Levels/color correction is deterministic browser Canvas processing, and brush-based edge repair gives staff a manual fallback. Generative Auto Fix and unofficial ChatGPT browser-session wrappers are not part of this security or quality boundary.
