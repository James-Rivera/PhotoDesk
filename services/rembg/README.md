# CJNET PhotoDesk background-removal service

This homelab service accepts one authenticated portrait upload, runs a fixed rembg model, and returns a transparent PNG. It does not accept remote image URLs or client-selected models and does not retain uploads.

## Deploy

1. Install Docker Engine with Compose support on the homelab host.
2. Copy `.env.example` to `.env` and fill in the public Supabase project values and exact PhotoDesk origins.
3. Run `docker compose build` and `docker compose up -d`.
4. Confirm the container binds only to `127.0.0.1:7000`. Keep Tailscale Serve as the private administration/fallback path.
5. Publish `rembg.cloudavera.tech` through the existing outbound-only Cloudflare Tunnel to `http://localhost:7000`. Do not use Funnel or open an inbound router/firewall port.
6. Set `NEXT_PUBLIC_BACKGROUND_REMOVAL_API_URL=https://rembg.cloudavera.tech` in PhotoDesk, without `/v1`.

The first start downloads the selected model into the persistent `rembg-models` volume. `/health/live` responds while the model loads; `/health/ready` returns 503 until inference is ready. The legacy `/v1/health` path mirrors readiness for the current web client.

## Security boundary

- The browser sends its existing Supabase access token.
- The service asks Supabase to validate the token and calls the existing `is_active_staff()` RLS helper with that same user token.
- No Supabase service-role key is used.
- CORS allows only the configured PhotoDesk origins.
- Image bytes are processed in memory and responses use `Cache-Control: no-store`.
- Staff photo bytes pass through Cloudflare Tunnel before reaching the homelab. This is the approved availability/privacy tradeoff for workstations that do not run Tailscale.
- The origin remains loopback-only; Cloudflare Tunnel is the only public path and Tailscale remains available for private diagnostics.

## Tests

From this directory, with Python 3.11–3.13:

```powershell
python -m unittest discover -s tests
```

Full API tests require the dependencies from `requirements.txt`; production acceptance also requires representative CJNET portraits and the target homelab hardware.
