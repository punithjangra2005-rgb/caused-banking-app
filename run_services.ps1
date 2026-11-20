Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "       Starting Caused 2-Tier Architecture        " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Start Collector Backend
Write-Host "[1/2] Starting Tier 2: Collector Backend (:8000)..." -ForegroundColor Green
$collectorJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\monitoriz\collector'; .\venv\Scripts\Activate.ps1; python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload" -PassThru

# Start SaaS Frontend
Write-Host "[2/2] Starting Tier 1: SaaS Web Platform (:3000)..." -ForegroundColor Green
$saasJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\monitoriz\Saas platoform'; npm run dev" -PassThru

Write-Host "`nBoth tiers are starting in separate windows!" -ForegroundColor Yellow
Write-Host "SaaS & Support UI: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Collector API Docs: http://127.0.0.1:8000/docs`n" -ForegroundColor Cyan
