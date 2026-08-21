$ErrorActionPreference = "Stop"
$TaskName = "CJNET PhotoDesk Branch Server"
$FirewallName = "CJNET PhotoDesk Branch Server (Private LAN)"

$Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$Principal = [Security.Principal.WindowsPrincipal]::new($Identity)
if (-not $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  $Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  $Process = Start-Process powershell.exe -Verb RunAs -ArgumentList $Arguments -Wait -PassThru
  exit $Process.ExitCode
}

Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Get-NetFirewallRule -DisplayName $FirewallName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
$ShortcutPath = Join-Path ([Environment]::GetFolderPath("CommonDesktopDirectory")) "CJNET PhotoDesk Branch Server.url"
Remove-Item -LiteralPath $ShortcutPath -Force -ErrorAction SilentlyContinue

Write-Host "The branch-server task, Private-network firewall rule, and desktop shortcut were removed."
Write-Host "Application files and .env.local were kept so they can be recovered or removed manually."
