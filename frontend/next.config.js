/** @type {import('next').NextConfig} */
const nextConfig = {
  // Local-first desktop app: the frontend talks to a live local backend and
  // has client-side dynamic routes (e.g. /properties/[id]), so we render
  // on-demand instead of a fully static export.
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
};

module.exports = nextConfig;
