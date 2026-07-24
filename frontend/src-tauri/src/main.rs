// HostWise — Main entry point for the Tauri desktop application.
// All logic lives in lib.rs so it can be tested and reused.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    hostwise_lib::run();
}
