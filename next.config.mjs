/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages configuration
  images: {
    unoptimized: true
  },

  // Enable optimizations
  swcMinify: true,

  // Standard Next.js build
  trailingSlash: true,

  // Ensure compatibility
  experimental: {
    esmExternals: false
  }
};

export default nextConfig;
