/** @type {import('next').NextConfig} */
const nextConfig = {
  // Local-first desktop app: we bundle the frontend as a static export that
  // Tauri serves from its webview, talking to the local Rust backend. The
  // app is fully client-side rendered, so a static export works — dynamic
  // routes (e.g. /properties/[id]) are client-navigated.
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
  // In `next dev`, proxy /api to the local backend so browser dev at
  // http://localhost:3000 works. In dev the backend (the Tauri in-process
  // backend via rust_backend.rs, or the standalone `cargo run` binary) binds
  // port 8000, so we target it directly and statically. The destination is
  // fetched per-request, so even though rewrites() is only evaluated at boot —
  // before the embedded backend exists in `tauri:dev` — the proxy starts
  // working the moment 8000 comes up. Do NOT gate this on a live check or the
  // port file: doing so made /api 404 for the whole session (the recurring
  // "API Connection Error" bug), because next dev boots before the backend
  // writes its port. Ignored at export time (the desktop app uses
  // `get_backend_url` instead).
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [
      { source: '/api/:path*', destination: 'http://127.0.0.1:8000/api/:path*' },
    ];
  },
};

module.exports = nextConfig;
