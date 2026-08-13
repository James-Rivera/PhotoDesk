param(
  [string]$DotnetExecutable = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$localDotnet = Join-Path $projectRoot ".dotnet-sdk\dotnet.exe"
$dotnet = if ($DotnetExecutable) {
  (Resolve-Path $DotnetExecutable).Path
} elseif (Test-Path $localDotnet) {
  $localDotnet
} else {
  "dotnet"
}

$env:DOTNET_CLI_HOME = Join-Path $projectRoot ".dotnet-cli-home"
$project = Join-Path $projectRoot "print-helper\CJNET.PrintHelper.SmokeTests\CJNET.PrintHelper.SmokeTests.csproj"
& $dotnet run --project $project -c Release
if ($LASTEXITCODE -ne 0) { throw "Native print-helper simulation tests failed." }
