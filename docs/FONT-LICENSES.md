# Font licenses

## Satoshi

CJNET PhotoDesk uses **Satoshi** at weights 400, 500, and 700 through Fontshare's official webfont API:

`https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap`

Satoshi is distributed by Indian Type Foundry through Fontshare under the ITF Free Font License. It is free for personal and commercial web use. The license restricts redistributing or independently serving the font software, so the font binaries are intentionally **not committed or self-hosted** in this repository.

- License: https://www.fontshare.com/licenses/itf-ffl
- Font source: https://www.fontshare.com/fonts/satoshi

The interface falls back to Segoe UI, Arial, and the system sans-serif if Fontshare cannot be reached. This affects appearance only; local image layout and PDF generation do not depend on the webfont.
