# Stop both backend and frontend services.
param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173
)

& "$PSScriptRoot\stop-frontend.ps1" -Port $FrontendPort
& "$PSScriptRoot\stop-backend.ps1" -Port $BackendPort

Write-Host ""
Write-Host "All services stopped." -ForegroundColor Green
