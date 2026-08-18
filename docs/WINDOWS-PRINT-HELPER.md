# CJNET Windows Print Helper

The Print Helper lets Vercel-hosted PhotoDesk use the installed Windows printers without routing customer photos through another server. PhotoDesk keeps the exact point-based PDF for downloads and prepares a matching one-page A4 raster at 300 DPI for native printing.

The helper uses Windows Forms for both preview and printing. It does not embed Edge or WebView2. Staff see the A4 sheet, choose any installed or shared printer, open **PhotoDesk job settings**, set copies, and select one clear **Print** button. Driver choices made there belong only to that PhotoDesk print job and do not replace the printer defaults used by Word, browsers, or other applications.

## Staff installation

1. Download `CJNET-Print-Helper-Setup.exe`.
2. Double-click it and wait for the **installed and running** confirmation. Visual Studio Code, Node.js, the .NET SDK, Edge, and WebView2 are not required.
3. Open PhotoDesk and select **Print → Check**.
4. Right-click the CJNET tray icon and choose **Show pairing code**.
5. Enter the six-digit code in PhotoDesk and select **Pair**.

Pairing is one-time for each deployed PhotoDesk origin and Windows browser profile. The helper starts automatically with Windows.

## Daily printing

1. Build the layout and select **Print**.
2. Select **Open Windows print**.
3. Confirm the one-page A4 preview and choose the installed/shared photo printer.
4. Select **PhotoDesk job settings** and, inside the job-only Windows dialog, open the printer's settings to confirm the correct photo-paper media, Standard or High quality, Color, and one-sided printing. Select **OK** to keep those choices for this PhotoDesk job only.
5. Leave copies at 1 unless the customer needs duplicate sheets, then select **Print**.

PhotoDesk deliberately reapplies A4, portrait, actual physical page size, color, and one-sided output after the job settings dialog closes. Paper media and photo quality remain printer-driver settings, but they are stored in the helper's in-memory print document rather than the Windows printer-wide preferences.

Do not open Windows **Printing preferences** to prepare an individual PhotoDesk job. That screen changes the defaults inherited by Word, browser PDF printing, and other software. Use the helper's **PhotoDesk job settings** button instead.

**Browser fallback** and **Download PDF** remain available if the helper is stopped.

## Print accuracy

- The browser's pure layout engine remains the source of all photo positions and dimensions.
- The native print adapter converts those point values to a `2480 × 3508` A4 raster at 300 DPI.
- A 2×2-inch photo is `600 × 600` pixels and a 1×1-inch photo is `300 × 300` pixels.
- The Windows helper maps the full raster to the physical `210 × 297 mm` A4 page and compensates for the printer driver's reported hard-margin origin.
- The printer-safe layout margins remain part of the sheet, so non-borderless printers can clip their unprintable outer edge without shrinking the photos.

Always verify a new printer or driver with the calibration sheet before production use. The simulation tests validate the complete raster and native render geometry without a physical printer, but they cannot measure a printer's mechanical feed or driver calibration.

## Security

- The listener binds only to `127.0.0.1:17421`; other computers cannot reach it.
- A code shown by the local tray application is required before an origin receives a random 256-bit token.
- Tokens are bound to the exact website origin and stay on that Windows computer.
- Print requests require the token, accept PNG signatures only, are limited to 30 MB, and must be exactly `2480 × 3508` pixels.
- Temporary print sheets are deleted when the native preview closes.
- The helper displays a preview and requires an explicit final Print action.

## Verification and maintainer build

Run the printer-free native simulation suite:

```powershell
npm run test:print-helper
```

Install the current .NET 10 SDK and NSIS 3, then publish the staff package:

```powershell
.\scripts\publish-print-helper.ps1
```

This creates `print-helper\CJNET-Print-Helper-Setup.exe` and the ZIP fallback. The application is self-contained; the installer contains the helper executable and no WebView runtime loader. Publish the setup executable as a GitHub Release asset or authenticated internal download. Code-sign it with a trusted Windows certificate before broad distribution to reduce SmartScreen warnings.

## Uninstall

Run `Uninstall-CJNET-Print-Helper.ps1` from the extracted package. It stops the helper and removes its application files and startup shortcuts.
