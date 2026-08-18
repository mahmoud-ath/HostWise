/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The landing page only serves one small static logo, so skip the
  // on-demand image optimizer (and the optional `sharp` native dependency).
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
