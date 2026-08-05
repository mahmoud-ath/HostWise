/** @type {import('next').NextConfig} */
const nextConfig = {
  // Local-first desktop app: we bundle the frontend as a static export that
  // Tauri serves from its webview, talking to the local Python backend. The
  // app is fully client-side rendered, so a static export works — dynamic
  // routes (e.g. /properties/[id]) are client-navigated.
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
};

module.exports = nextConfig;
