# CJNET Epson Photo Printer Setup

This guide creates a dedicated Windows print destination for PhotoDesk. It does not add another physical printer. Both Windows queues use the same Epson L3210:

- `EPSON L3210 Series` for ordinary documents
- `EPSON L3210 - CJNET PHOTO` for A4 photo paper

The finished photo destination should appear in Brave as `EPSON L3210 - CJNET PHOTO on CJSERVER2`.

## Before starting

Perform the server steps on `CJSERVER2` with a Windows administrator account. Do not delete or modify the working Epson queue. The screenshots from the shop show connections on both `SERVER1` and `CJSERVER2`; use `CJSERVER2` for this guide unless the physical printer has intentionally moved.

## 1. Record the existing Epson connection

1. On `CJSERVER2`, press `Windows + R`.
2. Enter `control printers` and press Enter.
3. Right-click `EPSON L3210 Series` and select **Printer properties**.
4. On **Ports**, record the checked port, such as `USB001`.
5. On **Advanced**, record the driver name.
6. Close the dialog without changing anything.

## 2. Add the CJNET photo queue

1. Open **Settings → Bluetooth & devices → Printers & scanners**.
2. Select **Add device**, wait for the search, then choose **Add manually**.
3. Select **Add a local printer or network printer with manual settings**.
4. Choose **Use an existing port** and select the port recorded above.
5. Choose Epson and the same `EPSON L3210 Series` driver as the existing queue.
6. If asked, choose **Use the driver that is currently installed**.
7. Name the printer `EPSON L3210 - CJNET PHOTO`.
8. Finish without enabling printer pooling.

## 3. Configure photo-paper defaults

Open **Printing preferences** for the new queue and set:

| Setting | Required value |
| --- | --- |
| Document Size | A4 210 × 297 mm |
| Orientation | Portrait |
| Paper Type | Epson Photo Quality Ink Jet |
| Quality | Standard initially; use High after comparison testing |
| Color | Color |
| 2-Sided Printing | Off |
| Multi-Page | Off |
| Copies | 1 |
| Borderless | Off |

Optionally save the same driver settings as the Epson preset `CJNET A4 PHOTO`. The dedicated queue remains the normal staff workflow; the preset is only a backup.

## 4. Set queue-wide defaults

1. Open **Printer properties** for `EPSON L3210 - CJNET PHOTO`.
2. Select **Advanced → Printing Defaults**.
3. Enter the same A4 photo settings listed above.
4. Select **Apply**, then **OK**.

**Printing preferences** can be specific to the current Windows user. **Printing Defaults** provides the starting settings inherited by staff who connect to the shared queue. Check both dialogs even if the Epson driver appears to synchronize them.

## 5. Share the new queue

1. Open **Printer properties → Sharing**.
2. Select **Change Sharing Options** if it appears.
3. Enable **Share this printer**.
4. Set the share name to `CJNETPhoto`.
5. Apply the changes.

The network path is `\\CJSERVER2\CJNETPhoto`.

## 6. Connect each shop computer

1. Press `Windows + R` on the shop computer.
2. Enter `\\CJSERVER2` and press Enter.
3. Double-click `CJNETPhoto`.

If it is not shown, open **Settings → Bluetooth & devices → Printers & scanners → Add device → Add manually**, select **Select a shared printer by name**, and enter `\\CJSERVER2\CJNETPhoto`.

After installation, verify that **Printing preferences** shows A4, Epson Photo Quality Ink Jet, Color, and the chosen quality. If old settings were cached, remove only the new photo queue from that workstation, confirm **Printing Defaults** on `CJSERVER2`, and reconnect it.

## 7. Print from PhotoDesk

1. Build the sheet and select **Print**.
2. In Brave, select `EPSON L3210 - CJNET PHOTO on CJSERVER2`.
3. Use A4, Portrait, one page per sheet, and **Actual Size / 100%**.
4. Do not select Fit to page.
5. If the Windows system dialog shows **Let the app change my printing preferences**, turn it off when using the dedicated photo queue so the saved driver defaults remain authoritative.
6. Print the PhotoDesk calibration page before customer work and measure all three shapes with a ruler.

## Troubleshooting

- **The photo queue is missing in Brave:** close and reopen Brave after connecting the shared printer, then reopen the Destination list.
- **The job uses plain-paper quality:** check **Advanced → Printing Defaults** on `CJSERVER2`, not only the current user's Printing preferences.
- **The client still has old defaults:** remove `CJNET PHOTO` from that client and reconnect `\\CJSERVER2\CJNETPhoto`.
- **The dimensions are wrong:** use A4 and Actual Size / 100%; disable Fit, Shrink, and Scale to paper.
- **Jobs go to the wrong printer:** verify that the selected destination says `on CJSERVER2`, not `on SERVER1`.
- **The printer is busy:** both queues use one physical printer, so Windows will process their jobs through the same device in order.
