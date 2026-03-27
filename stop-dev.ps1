$ErrorActionPreference = "Stop"

function Get-PortProcessIds {
  param(
    [Parameter(Mandatory = $true)][int]$Port
  )

  $pattern = "127.0.0.1:$Port|0.0.0.0:$Port|\[::\]:$Port"
  $lines = netstat -ano -p tcp | Select-String $pattern
  $processIds = @()

  foreach ($line in $lines) {
    $parts = ($line.ToString() -split "\s+") | Where-Object { $_ }
    if ($parts.Count -lt 5) {
      continue
    }
    $matchedProcessId = $parts[-1]
    if ($matchedProcessId -match "^\d+$") {
      $processIds += [int]$matchedProcessId
    }
  }

  return $processIds | Sort-Object -Unique
}

foreach ($processId in (Get-PortProcessIds -Port 8080)) {
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

foreach ($processId in (Get-PortProcessIds -Port 5173)) {
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

Write-Host "Stopped backend and frontend dev processes."
