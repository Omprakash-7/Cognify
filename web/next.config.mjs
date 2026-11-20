/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ['pg', 'bcryptjs', 'jsonwebtoken'],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
