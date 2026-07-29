# ═══════════════════════════════════════════════════════════
# HostWise — Production Build Script (Windows)
# ═══════════════════════════════════════════════════════════
# Builds the desktop application:
#   1. Python backend (PyInstaller bundle)
#   2. Next.js frontend (static export)
#   3. Tauri desktop app (embeds backend + frontend)
#
# Prerequisites:
#   - Python 3.10+ (from python.org)
#   - Bun >= 1.0 (https://bun.sh) or Node.js 22+
#   - Rust stable (rustup)
#   - WebView2 (pre-installed on Windows 10+)
#
# Usage:
#   .\scripts\build.ps1                  # Build for Windows
#   .\scripts\build.ps1 -Clean           # Clean all build artifacts
#   .\scripts\build.ps1 -Bundles msi,nsis # Specific bundle targets
# ═══════════════════════════════════════════════════════════
param(
    [switch]$Clean = $false,
    [string]$Bundles = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $PSCommandPath
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$TauriDir = Join-Path $FrontendDir "src-tauri"

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  HostWise Production Build (Windows)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan

# ── Clean ─────────────────────────────────────────────────
if ($Clean) {
    Write-Host "[clean] Removing build artifacts..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$BackendDir\build", "$BackendDir\dist"
    Remove-Item -Force -ErrorAction SilentlyContinue "$BackendDir\*.spec"
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$FrontendDir\out"
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$TauriDir\target"
    Write-Host "  Cleaned." -ForegroundColor Green
    exit 0
}

# ── 1. Backend: PyInstaller ───────────────────────────────
Write-Host "`n[1/3] Building Python backend with PyInstaller..." -ForegroundColor Yellow
Push-Location $BackendDir

if (-not (Test-Path ".venv")) { python -m venv .venv }
.\.venv\Scripts\Activate.ps1
pip install -q -r requirements.txt pyinstaller

pyinstaller --onefile --name hostwise-backend `
    --add-data "app;app" `
    --hidden-import=uvicorn.logging `
    --hidden-import=uvicorn.loops.auto `
    --hidden-import=uvicorn.protocols.http.auto `
    --hidden-import=aiosqlite `
    --hidden-import=sqlalchemy.dialects.sqlite `
    --hidden-import=sqlalchemy.dialects.sqlite.aiosqlite `
    --hidden-import=pydantic `
    --hidden-import=pydantic_settings `
    --hidden-import=bcrypt `
    --hidden-import=jose `
    --collect-all aiosqlite `
    --noconsole `
    --noupx `
    --strip `
    --clean `
    launcher.py

if (-not (Test-Path "dist\hostwise-backend.exe")) { throw "PyInstaller build failed" }
Pop-Location
Write-Host "   Backend: $BackendDir\dist\hostwise-backend.exe" -ForegroundColor Green

# ── 2. Copy backend binary for Tauri sidecar ──────────────
Write-Host "`n[2/3] Copying backend binary to Tauri sidecar location..." -ForegroundColor Yellow

# Detect Rust target triple
$TargetTriple = (rustc -vV | Select-String "host:" | ForEach-Object { $_ -replace "host:\s+", "" }).Trim()
New-Item -ItemType Directory -Force -Path "$TauriDir\binaries" | Out-Null
Copy-Item "$BackendDir\dist\hostwise-backend.exe" "$TauriDir\binaries\hostwise-backend-${TargetTriple}.exe" -Force
Write-Host "   Sidecar: $TauriDir\binaries\hostwise-backend-${TargetTriple}.exe" -ForegroundColor Green

# ── 3. Frontend + Tauri ───────────────────────────────────
Write-Host "`n[3/3] Building Next.js frontend and Tauri desktop app..." -ForegroundColor Yellow
Push-Location $FrontendDir

# Install deps
bun install --silent 2>$null
if ($LASTEXITCODE -ne 0) { npm install --silent }

# Build Next.js static export
bun run build 2>$null
if ($LASTEXITCODE -ne 0) { npm run build }
Write-Host "   Frontend: $FrontendDir\out\" -ForegroundColor Green

# Build Tauri app
if ($Bundles -ne "") {
    Write-Host "   Tauri bundles: $Bundles" -ForegroundColor Yellow
    bun run tauri build --bundles $Bundles 2>$null
    if ($LASTEXITCODE -ne 0) { npx tauri build --bundles $Bundles }
} else {
    bun run tauri build 2>$null
    if ($LASTEXITCODE -ne 0) { npx tauri build }
}
Pop-Location

# ── Done ──────────────────────────────────────────────────
Write-Host "`n═══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "`n  Output:" -ForegroundColor Cyan
Write-Host "    Backend:  $BackendDir\dist\hostwise-backend.exe"
Write-Host "    Frontend: $FrontendDir\out\"
Write-Host "    Desktop:  $TauriDir\target\release\bundle\"
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
