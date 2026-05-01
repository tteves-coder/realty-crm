/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Unoptimized images = no Image Optimization API calls (saves Vercel credits)
  images: { unoptimized: true },
  // Skip type/lint errors in build
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Use static export for pages that don't need server-side rendering
  // Keep dynamic for auth pages
  experimental: {
    // Reduce serverless function count
    optimizePackageImports: ["date-fns", "@dnd-kit/core", "@dnd-kit/sortable"],
  },
};
module.exports = nextConfig;
