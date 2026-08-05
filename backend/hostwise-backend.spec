# -*- mode: python ; coding: utf-8 -*-
import sys
from PyInstaller.utils.hooks import collect_all

# WARNING (Windows): do NOT strip PE binaries. The MinGW/Git-for-Windows `strip`
# on the CI Windows runner corrupts python312.dll / _ssl.pyd / libssl / libcrypto,
# and real Windows then fails to load them with "Invalid access to memory
# location" (PyInstaller issue #5933). Wine tolerates the corruption, which is
# why local Wine builds pass while the CI release crashes. Stripping is safe on
# ELF/Mach-O, so we only disable it on win32.
_strip = sys.platform != "win32"

datas = [('app', 'app')]
binaries = []
hiddenimports = ['uvicorn.logging', 'uvicorn.loops.auto', 'uvicorn.protocols.http.auto', 'aiosqlite', 'sqlalchemy.dialects.sqlite', 'sqlalchemy.dialects.sqlite.aiosqlite', 'pydantic', 'pydantic_settings', 'bcrypt', 'jose', 'multipart']
tmp_ret = collect_all('aiosqlite')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]

# WeasyPrint (backend PDF export) — bundle its Python package data so
# render_pdf() works in the packaged app. Native deps (Pango/Cairo/GDK-PixBuf)
# must still be present on the target OS; see docs/pdf-report-system.md.
tmp_wp = collect_all('weasyprint')
datas += tmp_wp[0]; binaries += tmp_wp[1]; hiddenimports += tmp_wp[2]


a = Analysis(
    ['launcher.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='hostwise-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=_strip,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=_strip,
    upx=False,
    upx_exclude=[],
    name='hostwise-backend',
)
