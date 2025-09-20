/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove static export to enable API routes
  trailingSlash: true,
  images: {
    unoptimized: true
  },

  // Disable caching to prevent large files for Cloudflare Pages
  webpack: (config, { isServer }) => {
    config.cache = false
    return config
  }
};

export default nextConfig;
