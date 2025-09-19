/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages compatibility
  images: {
    unoptimized: true
  },

  // Enable SWC minification for production
  swcMinify: true
};

export default nextConfig;
