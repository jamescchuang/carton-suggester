# Start the FastAPI backend (uvicorn) in the background.
param([int]$Port = 8000)

. "$PSScriptRoot\_common.ps1"
$root = Get-Root

if (Test-Port $Port) {
    Write-Host "Backend already running on port $Port." -ForegroundColor Yellow
    exit 0
}

$id = Start-Service-Process -Name "backend" -FilePath "uv" `
    -ArgumentList @("run", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "$Port") `
    -WorkingDirectory $root

if (Wait-Port $Port 25) {
    Write-Host "Backend started (pid $id) -> http://127.0.0.1:$Port" -ForegroundColor Green
    Write-Host "  docs: http://127.0.0.1:$Port/docs"
    Write-Host "  logs: $(Join-Path (Get-RunDir) 'backend.out.log')"
} else {
    Write-Host "Backend process launched (pid $id) but port $Port did not come up in time." -ForegroundColor Red
    Write-Host "  check: $(Join-Path (Get-RunDir) 'backend.err.log')"
    exit 1
}
