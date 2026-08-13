$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$project = Join-Path $projectRoot "print-helper\CJNET.PrintHelper\CJNET.PrintHelper.csproj"
$dist = Join-Path $projectRoot "print-helper\dist"
$app = Join-Path $dist "app"
$archive = Join-Path $projectRoot "print-helper\CJNET-Print-Helper-win-x64.zip"

if (Test-Path $dist) { Remove-Item -LiteralPath $dist -Recurse -Force }
if (Test-Path $archive) { Remove-Item -LiteralPath $archive -Force }
dotnet publish $project -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o $app
Copy-Item (Join-Path $projectRoot "print-helper\Install-CJNET-Print-Helper.ps1") $dist
Copy-Item (Join-Path $projectRoot "print-helper\Uninstall-CJNET-Print-Helper.ps1") $dist
Copy-Item (Join-Path $projectRoot "docs\WINDOWS-PRINT-HELPER.md") $dist
Compress-Archive -Path (Join-Path $dist "*") -DestinationPath $archive
Write-Host "Created $archive" -ForegroundColor Green
