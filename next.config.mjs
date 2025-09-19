/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages configuration
  images: {
    unoptimized: true
  },

  // Cloudflare Pages optimizations
  trailingSlash: true,
  generateEtags: false,

  // Disable caching for Cloudflare Pages
  webpack: (config, { isServer }) => {
    // Disable webpack cache for smaller build size
    config.cache = false
    return config
  }
};

export default nextConfig;
