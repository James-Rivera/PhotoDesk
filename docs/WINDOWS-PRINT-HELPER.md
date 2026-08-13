# CJNET Windows Print Helper

The Print Helper lets Vercel-hosted PhotoDesk open Windows' native print dialog for the exact A4 PDF generated in browser memory. Staff can select any installed or shared printer and open its real **Preferences** screen, including Epson paper type, quality, and color controls.

It does not silently print, change global printer defaults, require a special printer queue, or upload the PDF to another server.

## Staff installation

1. Download and extract `CJNET-Print-Helper-win-x64.zip`.
2. Run `Install-CJNET-Print-Helper.ps1` with PowerShell.
3. Open PhotoDesk and select **Print → Check**.
4. Right-click the CJNET tray icon and choose **Show pairing code**.
5. Enter the six-digit code in PhotoDesk and select **Pair**.

Pairing is one-time for each deployed PhotoDesk origin and Windows browser profile. The helper starts automatically with Windows.

## Daily printing

1. Build the layout and select **Print**.
2. Select **Open Windows dialog**.
3. Choose the installed/shared Epson printer.
4. Open **Preferences** and confirm A4, Portrait, Epson Photo Quality Ink Jet, Standard or High, Color, one-sided, and no multi-page layout.
5. Confirm the print.

**Browser fallback** and **Download PDF** remain available if the helper is stopped.

## Security

- The listener binds only to `127.0.0.1:17421`; other computers cannot reach it.
- A code shown by the local tray application is required before an origin receives a random 256-bit token.
- Tokens are bound to the exact website origin and stay on that Windows computer.
- Print requests require the token, accept PDF signatures only, and are limited to 30 MB.
- Temporary PDFs are deleted when the helper preview closes.
- The helper deliberately opens a confirmation dialog and does not silently print.

## Maintainer build

Install the current .NET 10 SDK, then run:

```powershell
.\scripts\publish-print-helper.ps1
```

This creates `print-helper\CJNET-Print-Helper-win-x64.zip`. Publish the ZIP as a GitHub Release asset or authenticated internal download. Code-sign the executable and installer with a trusted Windows certificate before broad distribution to reduce SmartScreen warnings.

The app is .NET self-contained and uses Microsoft's WebView2 runtime, normally already present on Windows 10/11.

## Uninstall

Run `Uninstall-CJNET-Print-Helper.ps1` from the extracted package. It stops the helper and removes its application files and startup shortcuts.
