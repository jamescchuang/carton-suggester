# Start both backend and frontend services.
param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173
)

& "$PSScriptRoot\start-backend.ps1" -Port $BackendPort
& "$PSScriptRoot\start-frontend.ps1" -Port $FrontendPort

Write-Host ""
Write-Host "All services started. Open http://localhost:$FrontendPort" -ForegroundColor Green
