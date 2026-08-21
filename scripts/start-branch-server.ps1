$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvironmentPath = Join-Path $ProjectRoot ".env.local"
$BuildPath = Join-Path $ProjectRoot ".next\BUILD_ID"
$NextEntry = Join-Path $ProjectRoot "node_modules\next\dist\bin\next"

if (-not (Test-Path -LiteralPath $EnvironmentPath)) { throw "Missing .env.local. Run Install-CJNET-PhotoDesk-Branch-Server.bat first." }
if (-not (Test-Path -LiteralPath $BuildPath)) { throw "Missing production build. Run the branch-server installer while internet is available." }
if (-not (Test-Path -LiteralPath $NextEntry)) { throw "Missing Next.js runtime. Run npm install while internet is available." }

$PortableNode = Get-ChildItem (Join-Path $ProjectRoot ".branch-runtime\node-v*-win-x64\node.exe") -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
$NodePath = if ($PortableNode) { $PortableNode.FullName } else { (Get-Command node.exe -ErrorAction Stop).Source }
Set-Location -LiteralPath $ProjectRoot
& $NodePath $NextEntry start --hostname 0.0.0.0 --port 3210
