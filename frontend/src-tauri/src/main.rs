// HostWise — Main entry point for the Tauri desktop application.
// All logic lives in lib.rs so it can be tested and reused.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // ── Display/GPU compatibility layer ─────────────────────────────
    // Many Linux systems (VMs, containers, Wayland, older hardware, CI)
    // have broken or missing EGL/GPU drivers. WebKitGTK tries to create
    // an EGL display at startup, and on those systems it fails with:
    //   "Could not create default EGL display: EGL_BAD_PARAMETER"
    //
    // These env vars force software rendering and/or the X11 backend
    // (which doesn't require EGL), making the app work everywhere.
    //
    // Order matters: set ALL of them before Tauri initialises GTK.
    // ─────────────────────────────────────────────────────────────────
    std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1"); // WebKit software compositing
    std::env::set_var("GDK_BACKEND", "x11");                   // Skip Wayland EGL — use X11
    std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1");           // Mesa software rasteriser fallback
    std::env::set_var("GALLIUM_DRIVER", "llvmpipe");           // Explicit llvmpipe driver

    hostwise_lib::run();
}
