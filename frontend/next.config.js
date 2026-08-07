/** @type {import('next').NextConfig} */
const fs = require('fs');
const os = require('os');
const path = require('path');

// Platform app-data dir, mirroring backend-rs/src/core/config.rs so we can
// find the `hostwise.port` file the backend writes with its bound port.
function dataDir() {
  if (process.env.HOSTWISE_DATA_DIR) return process.env.HOSTWISE_DATA_DIR;
  const home = os.homedir();
  const base =
    process.platform === 'win32'
      ? process.env.APPDATA || home
      : process.platform === 'darwin'
        ? path.join(home, 'Library', 'Application Support')
        : process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  return path.join(base, 'hostwise');
}

function backendPort() {
  try {
    const port = fs.readFileSync(path.join(dataDir(), 'hostwise.port'), 'utf8').trim();
    return /^\d+$/.test(port) ? port : null;
  } catch {
    return null;
  }
}

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
  // In `next dev`, proxy /api to the backend's dynamic port so browser dev
  // works no matter which free port the backend bound to. Ignored at export
  // time (the desktop app uses `get_backend_url` instead).
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    const port = backendPort();
    if (!port) return [];
    return [
      { source: '/api/:path*', destination: `http://127.0.0.1:${port}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
