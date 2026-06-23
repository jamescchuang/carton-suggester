# Start the React (Vite) dev server in the background.
param([int]$Port = 5173)

. "$PSScriptRoot\_common.ps1"
$root = Get-Root
$frontend = Join-Path $root "frontend"

if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    Write-Host "Installing frontend dependencies (npm install)..." -ForegroundColor Cyan
    Push-Location $frontend
    npm install
    Pop-Location
}

if (Test-Port $Port) {
    Write-Host "Frontend already running on port $Port." -ForegroundColor Yellow
    exit 0
}

# Launch via cmd.exe so npm.cmd resolves correctly with redirected output.
# --strictPort keeps the port deterministic so stop-frontend can find it.
$id = Start-Service-Process -Name "frontend" -FilePath "cmd.exe" `
    -ArgumentList @("/c", "npm run dev -- --port $Port --strictPort") `
    -WorkingDirectory $frontend

if (Wait-Port $Port 30) {
    Write-Host "Frontend started (pid $id) -> http://localhost:$Port" -ForegroundColor Green
    Write-Host "  logs: $(Join-Path (Get-RunDir) 'frontend.out.log')"
} else {
    Write-Host "Frontend process launched (pid $id) but port $Port did not come up in time." -ForegroundColor Red
    Write-Host "  check: $(Join-Path (Get-RunDir) 'frontend.err.log')"
    exit 1
}
