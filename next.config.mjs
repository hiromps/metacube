/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages compatibility
  images: {
    unoptimized: true
  },

  // Enable SWC minification for production
  swcMinify: true,

  // Disable webpack cache to reduce bundle size
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.cache = false
    }
    return config
  }
};

export default nextConfig;
