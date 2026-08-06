; ────────────────────────────────────────────────────────────────────────
; HostWise — NSIS installer hooks
;
; The desktop app spawns an embedded Python backend (`hostwise-backend.exe`)
; that keeps its DLLs open while running. Tauri's default installer only
; stops `HostWise.exe`, so during an install/upgrade/uninstall a lingering
; backend locks the extracted runtime files under
;   %LOCALAPPDATA%\HostWise\hostwise-backend\_internal\*.dll
; and the installer fails with
;   "Error opening file for writing: ...\MSVCP140.dll"
;
; These hooks stop the backend before install and before uninstall.
; ────────────────────────────────────────────────────────────────────────

!macro _HostWiseStopBackend
  nsis_tauri_utils::FindProcess "hostwise-backend.exe"
  Pop $0
  ${If} $0 = 0
    nsis_tauri_utils::KillProcess "hostwise-backend.exe"
    Pop $0
    Sleep 500
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping HostWise backend..."
  !insertmacro _HostWiseStopBackend
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro _HostWiseStopBackend
!macroend
