/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages via Vercel build compatibility
  images: {
    unoptimized: true
  },

  // Vercel-compatible configuration
  generateEtags: false,

  // Ensure API routes are handled properly
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js']
  }
};

export default nextConfig;
