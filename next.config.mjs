/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages configuration
  images: {
    unoptimized: true
  },

  // Standard Next.js build for Cloudflare Pages
  trailingSlash: true,
  generateEtags: false
};

export default nextConfig;
