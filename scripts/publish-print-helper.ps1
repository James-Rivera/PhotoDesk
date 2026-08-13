param(
  [string]$DotnetExecutable = "dotnet"
)

$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$project = Join-Path $projectRoot "print-helper\CJNET.PrintHelper\CJNET.PrintHelper.csproj"
$dist = Join-Path $projectRoot "print-helper\dist"
$app = Join-Path $dist "app"
$archive = Join-Path $projectRoot "print-helper\CJNET-Print-Helper-win-x64.zip"
$installer = Join-Path $projectRoot "print-helper\CJNET-Print-Helper-Setup.exe"

if (Test-Path $dist) { Remove-Item -LiteralPath $dist -Recurse -Force }
if (Test-Path $archive) { Remove-Item -LiteralPath $archive -Force }
if (Test-Path $installer) { Remove-Item -LiteralPath $installer -Force }
& $DotnetExecutable publish $project -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o $app
if ($LASTEXITCODE -ne 0) { throw ".NET publish failed." }
Copy-Item (Join-Path $projectRoot "print-helper\Install-CJNET-Print-Helper.ps1") $dist
Copy-Item (Join-Path $projectRoot "print-helper\Uninstall-CJNET-Print-Helper.ps1") $dist
Copy-Item (Join-Path $projectRoot "docs\WINDOWS-PRINT-HELPER.md") $dist
Compress-Archive -Path (Join-Path $dist "*") -DestinationPath $archive

$makensisCommand = Get-Command makensis.exe -ErrorAction SilentlyContinue
$compilerPath = if ($makensisCommand) { $makensisCommand.Source } else { $null }
if (-not $compilerPath) {
  $fallbackCompiler = "${env:ProgramFiles(x86)}\NSIS\makensis.exe"
  if (Test-Path $fallbackCompiler) { $compilerPath = $fallbackCompiler }
}
if (-not $compilerPath) { throw "NSIS is required. Install it with: winget install --id NSIS.NSIS --exact" }
$installerScript = Join-Path $projectRoot "print-helper\installer.nsi"
& $compilerPath "/DSOURCE_DIR=$app" "/DOUTPUT_FILE=$installer" $installerScript
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $installer)) { throw "NSIS did not create the installer executable." }

Write-Host "Created $archive" -ForegroundColor Green
Write-Host "Created $installer" -ForegroundColor Green
