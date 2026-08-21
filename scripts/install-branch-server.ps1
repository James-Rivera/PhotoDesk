param([switch]$Elevated)

$ErrorActionPreference = "Stop"
$TaskName = "CJNET PhotoDesk Branch Server"
$FirewallName = "CJNET PhotoDesk Branch Server (Private LAN)"
$Port = 3210
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$NodeVersion = "22.22.3"
$NodeArchiveName = "node-v$NodeVersion-win-x64.zip"
$NodeArchiveHash = "6c8d54f635feff4df76c2ca80f45332eb2ff57d25226edce36592e51a177ee33"
$RuntimeRoot = Join-Path $ProjectRoot ".branch-runtime"
$NodeRoot = Join-Path $RuntimeRoot "node-v$NodeVersion-win-x64"

$Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$Principal = [Security.Principal.WindowsPrincipal]::new($Identity)
if (-not $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  $Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Elevated"
  $Process = Start-Process powershell.exe -Verb RunAs -ArgumentList $Arguments -Wait -PassThru
  exit $Process.ExitCode
}

Write-Host ""
Write-Host "CJNET PhotoDesk Branch Server Setup" -ForegroundColor Yellow
Write-Host "This computer will host PhotoDesk for other PCs on this branch's Private network."
Write-Host ""

$NodePath = Join-Path $NodeRoot "node.exe"
$NpmPath = Join-Path $NodeRoot "npm.cmd"
if (-not (Test-Path -LiteralPath $NodePath) -or -not (Test-Path -LiteralPath $NpmPath)) {
  New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
  $ArchivePath = Join-Path $RuntimeRoot $NodeArchiveName
  Write-Host "Downloading the verified portable PhotoDesk runtime..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri "https://nodejs.org/dist/v$NodeVersion/$NodeArchiveName" -OutFile $ArchivePath -UseBasicParsing
  $ActualHash = (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($ActualHash -ne $NodeArchiveHash) {
    Remove-Item -LiteralPath $ArchivePath -Force
    throw "The portable Node.js runtime checksum did not match the official release. Setup stopped safely."
  }
  Expand-Archive -LiteralPath $ArchivePath -DestinationPath $RuntimeRoot -Force
  Remove-Item -LiteralPath $ArchivePath -Force
}
if (-not (Test-Path -LiteralPath $NodePath) -or -not (Test-Path -LiteralPath $NpmPath)) { throw "The portable PhotoDesk runtime could not be prepared." }

$EnvironmentPath = Join-Path $ProjectRoot ".env.local"
$ExistingLocalMode = (Test-Path -LiteralPath $EnvironmentPath) -and ((Get-Content -LiteralPath $EnvironmentPath -Raw) -match '(?m)^PHOTODESK_BRANCH_LOCAL_MODE=true\s*$')
if (-not $ExistingLocalMode) {
  if (Test-Path -LiteralPath $EnvironmentPath) {
    $BackupPath = Join-Path $ProjectRoot ".env.local.before-branch-server"
    Copy-Item -LiteralPath $EnvironmentPath -Destination $BackupPath -Force
    Write-Host "Existing .env.local backed up to $BackupPath" -ForegroundColor Cyan
  }
  $Username = (Read-Host "Local staff username (example: branch-one)").Trim()
  $StaffName = (Read-Host "Branch label (example: CJNET Branch One)").Trim()
  & (Join-Path $PSScriptRoot "configure-branch-local.ps1") -Username $Username -StaffName $StaffName -Force
} else {
  Write-Host "Keeping the existing branch-local username and password." -ForegroundColor Cyan
}

Set-Location -LiteralPath $ProjectRoot
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Write-Host "Installing verified application dependencies..." -ForegroundColor Cyan
& $NpmPath install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }

Write-Host "Building the production application..." -ForegroundColor Cyan
& $NpmPath run build
if ($LASTEXITCODE -ne 0) { throw "PhotoDesk production build failed." }

$NextEntry = Join-Path $ProjectRoot "node_modules\next\dist\bin\next"
$Action = New-ScheduledTaskAction -Execute $NodePath -Argument "`"$NextEntry`" start --hostname 0.0.0.0 --port $Port" -WorkingDirectory $ProjectRoot
$Trigger = New-ScheduledTaskTrigger -AtStartup
$TaskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $TaskPrincipal -Settings $Settings -Description "Runs CJNET PhotoDesk on this branch's private LAN without requiring internet." -Force | Out-Null

Get-NetFirewallRule -DisplayName $FirewallName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $FirewallName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Private -RemoteAddress LocalSubnet | Out-Null

$ShortcutPath = Join-Path ([Environment]::GetFolderPath("CommonDesktopDirectory")) "CJNET PhotoDesk Branch Server.url"
$Shortcut = "[InternetShortcut]`r`nURL=http://localhost:$Port/app/template`r`nIconFile=$(Join-Path $ProjectRoot 'print-helper\CJNET.PrintHelper\CJNET.ico')`r`nIconIndex=0`r`n"
[System.IO.File]::WriteAllText($ShortcutPath, $Shortcut, [System.Text.Encoding]::ASCII)

Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName $TaskName

$Ready = $false
for ($Attempt = 0; $Attempt -lt 20; $Attempt += 1) {
  Start-Sleep -Seconds 1
  try {
    $Response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/login" -UseBasicParsing -TimeoutSec 2
    if ($Response.StatusCode -eq 200) { $Ready = $true; break }
  } catch { }
}
if (-not $Ready) { throw "The background task was installed but PhotoDesk did not become ready. Check Task Scheduler history for '$TaskName'." }

$PrivateProfiles = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue | Where-Object NetworkCategory -eq "Private")
$Addresses = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
  $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown"
} | Select-Object -ExpandProperty IPAddress -Unique)

Write-Host ""
Write-Host "PhotoDesk branch server is installed and running." -ForegroundColor Green
Write-Host "Host PC: http://localhost:$Port/app/template"
foreach ($Address in $Addresses) { Write-Host "Other PCs: http://${Address}:$Port/app/template" -ForegroundColor Yellow }
Write-Host "It will start automatically with Windows as '$TaskName'."
if ($PrivateProfiles.Count -eq 0) {
  Write-Warning "No active Windows Private network was detected. Set the shop LAN to Private in Windows Settings before other PCs connect. Do not enable this firewall rule on Public networks."
}
Write-Host "Reserve this host PC's IP in the branch router so client bookmarks remain stable."
Write-Host "Install the CJNET Print Helper separately on every PC that prints."
