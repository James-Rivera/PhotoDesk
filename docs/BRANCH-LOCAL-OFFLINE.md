# Branch-local offline PhotoDesk server

One Windows computer in each shop branch can host PhotoDesk for all PCs on that branch's private LAN. Internet access is required only for the initial installation and future application updates. A WAN outage does not stop PhotoDesk as long as the host PC and the branch's local router/switch remain powered and connected.

## What remains available

- Load JPG, PNG, and WebP photos from each client computer
- ID Photo and Photo Prints layouts and cropping
- Exact A4 preview and PDF download
- Browser printing and the CJNET Windows Print Helper
- Password-protected local staff access with login throttling

Customer Library, Supabase storage, administrator maintenance, and remote background removal are deliberately unavailable in branch-server mode. PhotoDesk does not fake cloud saves or retain unsafe synchronization queues. Source photos selected by staff remain in that browser's memory; they are not uploaded to the branch host.

## Network model

- The branch host listens on TCP port `3210`.
- Windows Firewall allows that port only on **Private** network profiles and only from `LocalSubnet`.
- The rule does not apply to Public network profiles.
- The router must not forward port 3210 to the internet.
- Each branch uses a separate local username, password hash, and cookie-signing secret.
- Each PC that uses native printing runs its own loopback-only CJNET Print Helper. Print raster data goes to that PC's helper, not through the branch host.

The branch LAN still needs to function during an internet outage. Ethernet through the local switch/router works without WAN access. Wi-Fi clients also work if the branch access point stays available even though its internet connection is down.

## One-run Windows installation

Use a dedicated, always-on Windows PC as the branch host. Before setup:

1. Extract `CJNET-PhotoDesk-Branch-Server.zip` to a permanent folder on the host PC. Do not run it from inside the ZIP.
2. Connect internet for this initial setup and set the shop's Windows network profile to **Private**.
3. Double-click `Install-CJNET-PhotoDesk-Branch-Server.bat`.
4. Approve the Windows administrator prompt.
5. Enter a branch-local username, branch label, and password when asked.

The package also contains the current `print-helper\CJNET-Print-Helper-Setup.exe` for the host and client PCs.

The installer automatically:

- backs up an existing `.env.local` before replacing a non-branch configuration;
- downloads a pinned portable Node.js runtime from `nodejs.org`, verifies its official SHA-256 checksum, and keeps it inside the PhotoDesk folder;
- generates a salted PBKDF2-SHA256 password hash and random signing secret;
- installs dependencies and creates the production build;
- registers the `CJNET PhotoDesk Branch Server` startup task under Windows `SYSTEM`;
- restricts TCP 3210 to the Private local subnet;
- starts PhotoDesk in the background;
- adds a host-PC desktop shortcut; and
- prints the URLs that other branch PCs should bookmark.

The host uses `http://localhost:3210/app/template`. Other computers use the displayed address, for example:

```text
http://192.168.1.25:3210/app/template
```

Reserve the host PC's IPv4 address in the branch router's DHCP settings. Otherwise its address can change and invalidate client bookmarks. Do not configure Windows or router port forwarding.

## Client PC setup

On every other shop PC:

1. Open the host's displayed `http://192.168.x.x:3210/app/template` address.
2. Sign in with the branch-local credentials.
3. Bookmark the page.
4. If that PC prints, install the current CJNET Print Helper and pair it from PhotoDesk.
5. Test a PDF download and an A4 Actual Size / 100% print.

The print helper accepts loopback, HTTPS, and RFC1918 private-LAN PhotoDesk origins. It rejects public HTTP origins, remains bound to `127.0.0.1:17421`, and requires its on-screen pairing code.

## Outage acceptance test

After all PCs are configured:

1. Restart the host and wait one minute.
2. Disconnect the branch's WAN cable or disable internet upstream without powering off the LAN router/switch.
3. From another PC, open the bookmarked PhotoDesk address.
4. Sign in, load a sample photo, create both an ID layout and Photo Prints layout, and download the exact PDF.
5. Open the print workflow on each printing PC.

If the host works but clients cannot connect, confirm that the Windows network profile is Private, the client is on the same subnet, and the `CJNET PhotoDesk Branch Server (Private LAN)` firewall rule is enabled.

## Updating

Reconnect internet on the host, stop the `CJNET PhotoDesk Branch Server` task in Task Scheduler, copy in the new release files without deleting `.env.local`, then run the installer again. Existing branch-local credentials are retained when the installer detects them.

## Removal and recovery

Run `Uninstall-CJNET-PhotoDesk-Branch-Server.bat` to remove the background task, firewall rule, and desktop shortcut. Application files and `.env.local` are retained for recovery and must be deleted manually if no longer needed.

If the password is lost, stop the task and run `scripts/configure-branch-local.ps1 -Force`, rebuild, then restart the task. Replacing the local configuration invalidates existing sessions and does not affect Supabase accounts or customer photos.
