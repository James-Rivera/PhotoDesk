$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$OutputRoot = Join-Path $ProjectRoot "branch-server\dist"
$Staging = Join-Path $OutputRoot "CJNET-PhotoDesk-Branch-Server"
$Archive = Join-Path $OutputRoot "CJNET-PhotoDesk-Branch-Server.zip"

if (Test-Path -LiteralPath $Staging) { Remove-Item -LiteralPath $Staging -Recurse -Force }
if (Test-Path -LiteralPath $Archive) { Remove-Item -LiteralPath $Archive -Force }
New-Item -ItemType Directory -Force -Path $Staging | Out-Null

$Files = @(
  ".env.example",
  "Install-CJNET-PhotoDesk-Branch-Server.bat",
  "Uninstall-CJNET-PhotoDesk-Branch-Server.bat",
  "next.config.ts",
  "package.json",
  "package-lock.json",
  "postcss.config.mjs",
  "tsconfig.json"
)
foreach ($File in $Files) { Copy-Item -LiteralPath (Join-Path $ProjectRoot $File) -Destination (Join-Path $Staging $File) }

Copy-Item -LiteralPath (Join-Path $ProjectRoot "src") -Destination $Staging -Recurse
Copy-Item -LiteralPath (Join-Path $ProjectRoot "public") -Destination $Staging -Recurse

$ScriptsDestination = Join-Path $Staging "scripts"
New-Item -ItemType Directory -Force -Path $ScriptsDestination | Out-Null
foreach ($Script in @("configure-branch-local.ps1", "install-branch-server.ps1", "start-branch-local.ps1", "start-branch-server.ps1", "uninstall-branch-server.ps1")) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $Script) -Destination $ScriptsDestination
}

$DocsDestination = Join-Path $Staging "docs"
New-Item -ItemType Directory -Force -Path $DocsDestination | Out-Null
Copy-Item -LiteralPath (Join-Path $ProjectRoot "docs\BRANCH-LOCAL-OFFLINE.md") -Destination $DocsDestination
Copy-Item -LiteralPath (Join-Path $ProjectRoot "docs\WINDOWS-PRINT-HELPER.md") -Destination $DocsDestination

$HelperDestination = Join-Path $Staging "print-helper"
New-Item -ItemType Directory -Force -Path (Join-Path $HelperDestination "CJNET.PrintHelper") | Out-Null
Copy-Item -LiteralPath (Join-Path $ProjectRoot "print-helper\CJNET-Print-Helper-Setup.exe") -Destination $HelperDestination
Copy-Item -LiteralPath (Join-Path $ProjectRoot "print-helper\CJNET.PrintHelper\CJNET.ico") -Destination (Join-Path $HelperDestination "CJNET.PrintHelper")

Compress-Archive -Path $Staging -DestinationPath $Archive -CompressionLevel Optimal
Write-Host "Created $Archive" -ForegroundColor Green
