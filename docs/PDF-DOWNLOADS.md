# PDF download organization

PhotoDesk PDF filenames put the optional customer name first, followed by the preset and a short local date/time:

```text
James-Rivera_Normal_260813-174509.pdf
```

When staff leave the customer field blank, the filename is still unique:

```text
CJNET_Normal_260813-174509.pdf
```

The Builder does not copy a local image filename into the customer field. A selected Library photo may fill its saved customer name, which staff can clear before downloading.

## One-time Windows and Brave setup

From PowerShell in the project directory, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-download-folder.ps1
```

The helper creates:

```text
Documents\CJNET PhotoDesk PDFs
```

Then open `brave://settings/downloads`, change the download location to that folder, and turn off **Ask where to save each file before downloading**. This browser setting only needs to be done once for that Windows/Brave profile.

## Why PhotoDesk cannot silently select the folder

Web browsers intentionally prevent websites from changing the computer's download location or silently writing to arbitrary folders. This protects the shop computer from malicious sites. A website can suggest the filename, which PhotoDesk now does, but Brave controls the destination folder.

A future installed desktop companion could create dated subfolders and write directly to them, but that adds installation and maintenance work. The fixed CJNET folder plus date-first filenames is the simpler and safer shop workflow.
