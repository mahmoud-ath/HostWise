# ═══════════════════════════════════════════════════════════
# HostWise — Production Build Script (Windows)
# ═══════════════════════════════════════════════════════════
# Builds the complete desktop application:
#   1. Python backend (PyInstaller bundle)
#   2. Next.js frontend (static export)
#   3. Tauri desktop shell (Rust)
#
# Produces:
#   Windows: .msi, .exe (NSIS installer)
#
# Prerequisites:
#   - Python 3.10+ (from python.org)
#   - Rust (https://rustup.rs)
#   - Bun >= 1.0 (https://bun.sh) or Node.js 22+
#
# Usage:
#   .\scripts\build.ps1           # Build for Windows
#   .\scripts\build.ps1 -Clean    # Clean all build artifacts
# ═══════════════════════════════════════════════════════════
param(
    [switch]$Clean = $false
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $PSCommandPath
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$TauriDir = Join-Path $FrontendDir "src-tauri"
$BinariesDir = Join-Path $TauriDir "binaries"
$ConfPath = Join-Path $TauriDir "tauri.conf.json"

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  HostWise Production Build (Windows)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan

# ── Clean ─────────────────────────────────────────────────
if ($Clean) {
    Write-Host "[clean] Removing build artifacts..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$BackendDir\build", "$BackendDir\dist"
    Remove-Item -Force -ErrorAction SilentlyContinue "$BackendDir\*.spec"
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $BinariesDir, "$FrontendDir\out"
    Write-Host "  Cleaned." -ForegroundColor Green
    exit 0
}

# Detect target triple
$TargetTriple = (rustc -vV | Select-String "host:" | ForEach-Object { $_ -replace "host:\s+", "" }).Trim()
$BackendBin = "hostwise-backend-${TargetTriple}.exe"

try {
    # ── 1. Backend: PyInstaller ───────────────────────────
    Write-Host "`n[1/4] Building Python backend with PyInstaller..." -ForegroundColor Yellow
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
        --collect-all app `
        --collect-all aiosqlite `
        --noconsole `
        launcher.py

    if (-not (Test-Path "dist\hostwise-backend.exe")) { throw "PyInstaller build failed" }

    New-Item -ItemType Directory -Force -Path $BinariesDir | Out-Null
    Copy-Item "dist\hostwise-backend.exe" (Join-Path $BinariesDir $BackendBin)
    Pop-Location
    Write-Host "   Backend: $BinariesDir\$BackendBin" -ForegroundColor Green

    # ── 2. Configure Tauri ────────────────────────────────
    Write-Host "`n[2/4] Configuring Tauri for production..." -ForegroundColor Yellow
    $cfg = Get-Content $ConfPath -Raw | ConvertFrom-Json
    $cfg.bundle | Add-Member -Force -MemberType NoteProperty -Name externalBin -Value @("binaries/hostwise-backend")
    $cfg.bundle | Add-Member -Force -MemberType NoteProperty -Name resources -Value @("binaries/*")
    $cfg | ConvertTo-Json -Depth 10 | Set-Content $ConfPath
    Write-Host "   externalBin + resources configured." -ForegroundColor Green

    # ── 3. Frontend ───────────────────────────────────────
    Write-Host "`n[3/4] Building Next.js frontend..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    bun install --silent 2>$null
    bun run build 2>$null
    if ($LASTEXITCODE -ne 0) {
        # Fallback to npm
        npm install --silent
        npm run build
    }
    Pop-Location
    Write-Host "   Frontend: $FrontendDir\out\" -ForegroundColor Green

    # ── 4. Tauri ──────────────────────────────────────────
    Write-Host "`n[4/4] Building Tauri desktop app..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
    bun run tauri build
    if ($LASTEXITCODE -ne 0) { throw "Tauri build failed ($LASTEXITCODE)" }
    Pop-Location

    # ── Done ──────────────────────────────────────────────
    Write-Host "`n═══════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  Build Complete!" -ForegroundColor Green
    Write-Host "`n  Artifacts:" -ForegroundColor Cyan
    Get-ChildItem "$TauriDir\target\release\bundle\nsis\*.exe","$TauriDir\target\release\bundle\msi\*.msi" -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "    $($_.Name) ($('{0:N1} MB' -f ($_.Length/1MB)))"
    }
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Green

} finally {
    # Restore dev config
    if (Test-Path $ConfPath) {
        $cfg = Get-Content $ConfPath -Raw | ConvertFrom-Json
        if ($cfg.bundle.externalBin) { $cfg.bundle.PSObject.Properties.Remove('externalBin') }
        if ($cfg.bundle.resources) { $cfg.bundle.PSObject.Properties.Remove('resources') }
        $cfg | ConvertTo-Json -Depth 10 | Set-Content $ConfPath
    }
}
