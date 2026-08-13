$ErrorActionPreference = "Stop"

$documents = [Environment]::GetFolderPath("MyDocuments")
$downloadFolder = Join-Path $documents "CJNET PhotoDesk PDFs"

New-Item -ItemType Directory -Path $downloadFolder -Force | Out-Null

Write-Host "CJNET PDF folder is ready:" -ForegroundColor Green
Write-Host $downloadFolder
Write-Host ""
Write-Host "One-time Brave setup:" -ForegroundColor Yellow
Write-Host "1. Open brave://settings/downloads"
Write-Host "2. Beside Location, choose Change"
Write-Host "3. Select the folder shown above"
Write-Host "4. Turn off 'Ask where to save each file before downloading'"
Write-Host ""
Write-Host "PhotoDesk will then download every uniquely named PDF into this folder."
