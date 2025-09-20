import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages configuration
  images: {
    unoptimized: true
  },

  // Standard Next.js build for Cloudflare Pages
  trailingSlash: true,
  generateEtags: false,

  // Disable caching for Cloudflare Pages
  webpack: (config, { isServer }) => {
    // Disable webpack cache for smaller build size
    config.cache = false
    return config
  }
};

// Set up development platform
if (process.env.NODE_ENV === 'development') {
  await setupDevPlatform()
}

export default nextConfig;
