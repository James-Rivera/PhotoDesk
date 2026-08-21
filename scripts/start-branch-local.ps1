$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvironmentPath = Join-Path $ProjectRoot ".env.local"
$BuildPath = Join-Path $ProjectRoot ".next\BUILD_ID"

if (-not (Test-Path -LiteralPath $EnvironmentPath)) { throw "Missing .env.local. Run scripts/configure-branch-local.ps1 first." }
if (-not (Test-Path -LiteralPath $BuildPath)) { throw "Missing production build. Run npm run build while internet is available." }

Set-Location -LiteralPath $ProjectRoot
& npm.cmd run start -- --hostname 127.0.0.1 --port 3210
