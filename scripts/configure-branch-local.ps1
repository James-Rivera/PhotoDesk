param(
  [string]$Username = "branch",
  [string]$StaffName = "CJNET Branch Staff",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvironmentPath = Join-Path $ProjectRoot ".env.local"

if ((Test-Path -LiteralPath $EnvironmentPath) -and -not $Force) {
  throw ".env.local already exists. Back it up, then rerun with -Force only if you intend to replace it."
}

$SecurePassword = Read-Host "Create the branch-local PhotoDesk password" -AsSecureString
$Credential = [System.Net.NetworkCredential]::new("", $SecurePassword)
$PlainPassword = $Credential.Password
if ($PlainPassword.Length -lt 10) { throw "Use a local password with at least 10 characters." }
if ($StaffName.Length -gt 80 -or $StaffName -match '[\r\n]') { throw "Staff name must be one line and no longer than 80 characters." }

$Salt = [byte[]]::new(16)
$Random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$Random.GetBytes($Salt)
$Deriver = [System.Security.Cryptography.Rfc2898DeriveBytes]::new($PlainPassword, $Salt, 210000, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
$Hash = $Deriver.GetBytes(32)
$SecretBytes = [byte[]]::new(32)
$Random.GetBytes($SecretBytes)
$Random.Dispose()

function ConvertTo-Base64Url([byte[]]$Value) {
  return [Convert]::ToBase64String($Value).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$PasswordHash = "pbkdf2-sha256`$210000`$(ConvertTo-Base64Url $Salt)`$(ConvertTo-Base64Url $Hash)"
$AuthSecret = ConvertTo-Base64Url $SecretBytes
$SafeUsername = $Username.Trim().ToLowerInvariant()
if ($SafeUsername -notmatch '^[a-z0-9][a-z0-9._-]{2,31}$') { throw "Username must be 3-32 lowercase letters, numbers, dots, underscores, or hyphens." }

$Contents = @"
# Generated for this workstation by scripts/configure-branch-local.ps1.
# Do not copy this file to another branch and do not commit it.
PHOTODESK_BRANCH_LOCAL_MODE=true
PHOTODESK_LOCAL_USERNAME=$SafeUsername
PHOTODESK_LOCAL_STAFF_NAME=$StaffName
PHOTODESK_LOCAL_ROLE=staff
PHOTODESK_LOCAL_PASSWORD_HASH=$PasswordHash
PHOTODESK_LOCAL_AUTH_SECRET=$AuthSecret
"@

[System.IO.File]::WriteAllText($EnvironmentPath, $Contents, [System.Text.UTF8Encoding]::new($false))
$PlainPassword = $null
$Credential = $null
Write-Host "Branch-local authentication was written to $EnvironmentPath"
Write-Host "Next: run npm install, npm run build, then npm run start:branch."
