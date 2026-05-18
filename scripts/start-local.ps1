# Home Sorter — lokalno pokretanje (API + frontend)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not (Test-Path "server\node_modules\express")) {
  Write-Host "Instaliram server pakete..." -ForegroundColor Yellow
  npm install --prefix server
}

if (-not (Test-Path "server\dev.db")) {
  Write-Host "Kreiram bazu (prvi put)..." -ForegroundColor Yellow
  npm run setup:server
}

Write-Host ""
Write-Host "Pokrecem API (3001) i aplikaciju (5173)..." -ForegroundColor Green
Write-Host "Login: http://localhost:5173/login" -ForegroundColor Cyan
Write-Host ""

npm run dev:all
