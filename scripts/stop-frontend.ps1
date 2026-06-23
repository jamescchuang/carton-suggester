# Stop the React (Vite) dev server.
param([int]$Port = 5173)

. "$PSScriptRoot\_common.ps1"

if (Stop-Service-Process -Name "frontend" -Port $Port) {
    Write-Host "Frontend stopped." -ForegroundColor Green
} else {
    Write-Host "Frontend was not running." -ForegroundColor Yellow
}
