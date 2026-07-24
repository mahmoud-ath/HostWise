// HostWise — Main entry point for the Tauri desktop application.
// All logic lives in lib.rs so it can be tested and reused.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Force WebKit software rendering to avoid EGL issues on systems
    // without proper GPU drivers (VMs, older hardware, containers).
    std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");

    hostwise_lib::run();
}
