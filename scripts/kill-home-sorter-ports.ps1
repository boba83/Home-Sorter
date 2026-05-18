# Oslobodi portove koje Home Sorter koristi (stari node/vite procesi).
$ErrorActionPreference = 'SilentlyContinue'
$ports = @(3001, 5173)
foreach ($port in $ports) {
  $lines = netstat -ano | Select-String ":$port\s+.*LISTENING"
  foreach ($line in $lines) {
    $parts = ($line.ToString() -split '\s+') | Where-Object { $_ -ne '' }
    $procId = $parts[-1]
    if ($procId -match '^\d+$' -and [int]$procId -gt 0) {
      Write-Host "Port $port -> zaustavljam PID $procId"
      taskkill /F /PID $procId 2>$null | Out-Null
    }
  }
}
Write-Host "Gotovo. Pokrenite: npm run dev:all" -ForegroundColor Green
