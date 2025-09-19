/** @type {import('next').NextConfig} */
const nextConfig = {
  // Basic Cloudflare Pages compatibility
  images: {
    unoptimized: true
  },

  // Disable problematic features for initial deployment
  swcMinify: false,

  // Simple configuration first
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*'
      }
    ]
  }
};

export default nextConfig;
