$ErrorActionPreference = "Stop"
$installRoot = Join-Path $env:LOCALAPPDATA "CJNET\PrintHelper"
$startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\CJNET Print Helper.lnk"
$startup = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\CJNET Print Helper.lnk"

Get-Process "CJNET.PrintHelper" -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -LiteralPath $startMenu -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $startup -Force -ErrorAction SilentlyContinue
if (Test-Path $installRoot) { Remove-Item -LiteralPath $installRoot -Recurse -Force }
Write-Host "CJNET Print Helper was removed." -ForegroundColor Green
