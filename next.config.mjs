/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages configuration
  images: {
    unoptimized: true
  },

  // Enable static export
  output: 'export',
  distDir: 'out',
  trailingSlash: true,
  generateEtags: false,

  // Disable features that don't work with static export
  // API routes will be moved to separate Cloudflare Functions

  // Disable caching for Cloudflare Pages
  webpack: (config, { isServer }) => {
    // Disable webpack cache for smaller build size
    config.cache = false
    return config
  }
};

export default nextConfig;
