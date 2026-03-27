$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "article-master"
$frontendDir = Join-Path $root "article-admin-main"
$backendPython = Join-Path $backendDir ".venv\Scripts\python.exe"
$frontendCorepack = "E:\node.js\corepack.cmd"

function Test-Url {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSec = 5
  )

  try {
    $response = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec $TimeoutSec
    return $response.StatusCode
  } catch {
    return $null
  }
}

function Wait-Url {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$RetryCount = 20,
    [int]$DelaySeconds = 1
  )

  for ($index = 0; $index -lt $RetryCount; $index++) {
    $status = Test-Url -Url $Url
    if ($status) {
      return $status
    }
    Start-Sleep -Seconds $DelaySeconds
  }

  return $null
}

function Ensure-Backend {
  $running = Test-Url -Url "http://127.0.0.1:8080/docs"
  if ($running) {
    Write-Host "Backend already running on http://127.0.0.1:8080"
    return
  }

  if (-not (Test-Path $backendPython)) {
    throw "Backend Python not found: $backendPython"
  }

  Start-Process -WindowStyle Hidden -FilePath $backendPython -ArgumentList @(
    "-m", "uvicorn", "app.api:app", "--host", "127.0.0.1", "--port", "8080"
  ) -WorkingDirectory $backendDir | Out-Null
}

function Ensure-Frontend {
  $running = Test-Url -Url "http://127.0.0.1:5173"
  if ($running) {
    Write-Host "Frontend already running on http://127.0.0.1:5173"
    return
  }

  if (-not (Test-Path $frontendCorepack)) {
    throw "corepack.cmd not found: $frontendCorepack"
  }

  Start-Process -WindowStyle Hidden -FilePath "cmd.exe" -ArgumentList @(
    "/c",
    "`"$frontendCorepack`" pnpm dev --host 127.0.0.1 --port 5173"
  ) -WorkingDirectory $frontendDir | Out-Null
}

Ensure-Backend
Ensure-Frontend

$backendStatus = Wait-Url -Url "http://127.0.0.1:8080/docs"
$frontendStatus = Wait-Url -Url "http://127.0.0.1:5173" -RetryCount 60

Write-Host ""
Write-Host "Backend:  http://127.0.0.1:8080/docs  status=$backendStatus"
Write-Host "Frontend: http://127.0.0.1:5173       status=$frontendStatus"

if (-not $backendStatus) {
  throw "Backend failed to start on http://127.0.0.1:8080"
}

if (-not $frontendStatus) {
  throw "Frontend failed to start on http://127.0.0.1:5173"
}
