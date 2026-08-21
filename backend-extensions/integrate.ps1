#!/usr/bin/env pwsh
# ==============================================================
# YourHealth.AI — Backend Integration Script
# Copies new route files into C:\UTH.AI\backend and rebuilds
# Run from: c:\yourhealth.AI\backend-extensions\
# Usage: .\integrate.ps1
# ==============================================================

$Source  = "C:\yourhealth.AI\backend-extensions"
$Backend = "C:\UTH.AI\backend"

Write-Host "`n╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  YourHealth.AI Backend Integration v2   ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝`n" -ForegroundColor Cyan

# ————————————————————————
# 1. Copy new route files
# ————————————————————————
Write-Host "[ 1/5 ] Copying new route files..." -ForegroundColor Yellow

$routes = @(
  "ai.routes.ts",
  "appointments.routes.ts",
  "doctors.routes.ts",
  "admin-extended.routes.ts",
  "patient.routes.ts",
  "doctor-extended.routes.ts"
)

foreach ($route in $routes) {
  $src = Join-Path "$Source\src\routes" $route
  $dst = Join-Path "$Backend\src\routes" $route
  if (Test-Path $src) {
    Copy-Item -Path $src -Destination $dst -Force
    Write-Host "  ✓ Copied: $route" -ForegroundColor Green
  } else {
    Write-Host "  ✗ Missing: $src" -ForegroundColor Red
  }
}

# ————————————————————————
# 2. Back up and replace index.ts
# ————————————————————————
Write-Host "`n[ 2/5 ] Replacing index.ts..." -ForegroundColor Yellow

$indexSrc = "$Source\src\index.ts"
$indexDst = "$Backend\src\index.ts"
$indexBak = "$Backend\src\index.ts.bak"

if (Test-Path $indexDst) {
  Copy-Item -Path $indexDst -Destination $indexBak -Force
  Write-Host "  ✓ Backup created: index.ts.bak" -ForegroundColor Green
}
Copy-Item -Path $indexSrc -Destination $indexDst -Force
Write-Host "  ✓ index.ts replaced" -ForegroundColor Green

# ————————————————————————
# 3. Replace Prisma schema
# ————————————————————————
Write-Host "`n[ 3/5 ] Updating Prisma schema..." -ForegroundColor Yellow

$schemaSrc = "$Source\prisma\schema.prisma"
$schemaDst = "$Backend\prisma\schema.prisma"
$schemaBak = "$Backend\prisma\schema.prisma.bak"

if (Test-Path $schemaDst) {
  Copy-Item -Path $schemaDst -Destination $schemaBak -Force
  Write-Host "  ✓ Backup created: schema.prisma.bak" -ForegroundColor Green
}
Copy-Item -Path $schemaSrc -Destination $schemaDst -Force
Write-Host "  ✓ schema.prisma replaced" -ForegroundColor Green

# ————————————————————————
# 4. Run Prisma migrate
# ————————————————————————
Write-Host "`n[ 4/5 ] Running Prisma migration..." -ForegroundColor Yellow

Push-Location $Backend
try {
  npx prisma migrate dev --name "extend_v2_yourhealth" --skip-generate
  Write-Host "  ✓ Migration applied" -ForegroundColor Green
  npx prisma generate
  Write-Host "  ✓ Prisma client generated" -ForegroundColor Green
} catch {
  Write-Host "  ⚠ Migration failed — try: npx prisma db push" -ForegroundColor Red
  Write-Host "  Or run manually: npx prisma migrate dev --name extend_v2" -ForegroundColor Yellow
}
Pop-Location

# ————————————————————————
# 5. Start dev server
# ————————————————————————
Write-Host "`n[ 5/5 ] Starting backend dev server..." -ForegroundColor Yellow
Write-Host "  Running: npm run dev in $Backend`n" -ForegroundColor Cyan

Push-Location $Backend
npm run dev
Pop-Location
