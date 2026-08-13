$ErrorActionPreference = "Stop"
$appFolder = Join-Path $PSScriptRoot "app"
$source = if (Test-Path (Join-Path $appFolder "CJNET.PrintHelper.exe")) { $appFolder } else { $PSScriptRoot }
$installRoot = Join-Path $env:LOCALAPPDATA "CJNET\PrintHelper"
$startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\CJNET Print Helper.lnk"
$startup = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\CJNET Print Helper.lnk"

if (-not (Test-Path (Join-Path $source "CJNET.PrintHelper.exe"))) { throw "Extract the complete CJNET Print Helper ZIP before installing." }
Get-Process "CJNET.PrintHelper" -ErrorAction SilentlyContinue | Stop-Process -Force
New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $source "CJNET.PrintHelper.exe") -Destination $installRoot -Force
Copy-Item -LiteralPath (Join-Path $source "WebView2Loader.dll") -Destination $installRoot -Force

$shell = New-Object -ComObject WScript.Shell
foreach ($shortcutPath in @($startMenu, $startup)) {
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = Join-Path $installRoot "CJNET.PrintHelper.exe"
  $shortcut.WorkingDirectory = $installRoot
  $shortcut.Description = "CJNET PhotoDesk Windows print bridge"
  $shortcut.Save()
}

Start-Process -FilePath (Join-Path $installRoot "CJNET.PrintHelper.exe") -WindowStyle Hidden
Write-Host "CJNET Print Helper installed and started." -ForegroundColor Green
Write-Host "In PhotoDesk, click Print, then Check. Use the tray icon to show the pairing code."
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show("CJNET Print Helper is installed and running. In PhotoDesk, click Print, then Check.", "CJNET Print Helper", "OK", "Information") | Out-Null
