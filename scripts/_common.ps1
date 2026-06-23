# Shared helpers for the start/stop scripts. Dot-source this file.

# Repository root (parent of the scripts/ directory).
function Get-Root {
    return (Split-Path -Parent $PSScriptRoot)
}

# Directory holding pid files and logs.
function Get-RunDir {
    $dir = Join-Path (Get-Root) ".run"
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
    }
    return $dir
}

# True if something is listening on the given TCP port.
function Test-Port([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

# Wait until a port is listening (or timeout). Returns $true if it came up.
function Wait-Port([int]$Port, [int]$TimeoutSec = 20) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-Port $Port) { return $true }
        Start-Sleep -Milliseconds 400
    }
    return $false
}

# Recursively stop a process and all of its descendants.
function Stop-ProcessTree([int]$ProcessId) {
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
        Stop-ProcessTree -ProcessId $child.ProcessId
    }
    try { Stop-Process -Id $ProcessId -Force -ErrorAction Stop } catch {}
}

# Stop whatever process tree is listening on a port.
function Stop-Port([int]$Port) {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    $owners = $conns.OwningProcess | Sort-Object -Unique
    foreach ($owner in $owners) {
        if ($owner) { Stop-ProcessTree -ProcessId ([int]$owner) }
    }
}

# Launch a background service, recording its pid and redirecting output to logs.
function Start-Service-Process {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory
    )
    $runDir = Get-RunDir
    $out = Join-Path $runDir "$Name.out.log"
    $err = Join-Path $runDir "$Name.err.log"
    $proc = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList `
        -WorkingDirectory $WorkingDirectory `
        -RedirectStandardOutput $out -RedirectStandardError $err `
        -WindowStyle Hidden -PassThru
    $proc.Id | Out-File (Join-Path $runDir "$Name.pid") -Encoding ascii
    return $proc.Id
}

# Stop a service by its pid file (whole tree) and, as a safety net, by port.
function Stop-Service-Process {
    param(
        [string]$Name,
        [int]$Port
    )
    $runDir = Get-RunDir
    $pidFile = Join-Path $runDir "$Name.pid"
    $stopped = $false

    if (Test-Path $pidFile) {
        $servicePid = (Get-Content $pidFile | Select-Object -First 1).Trim()
        if ($servicePid) {
            Stop-ProcessTree -ProcessId ([int]$servicePid)
            $stopped = $true
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }

    if (Test-Port $Port) {
        Stop-Port $Port
        $stopped = $true
    }
    return $stopped
}
