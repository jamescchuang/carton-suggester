# Stop the FastAPI backend.
param([int]$Port = 8000)

. "$PSScriptRoot\_common.ps1"

if (Stop-Service-Process -Name "backend" -Port $Port) {
    Write-Host "Backend stopped." -ForegroundColor Green
} else {
    Write-Host "Backend was not running." -ForegroundColor Yellow
}
