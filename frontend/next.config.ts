import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration Turbopack (Next.js 16+)
  turbopack: {},
  
  webpack: (config, { isServer }) => {
    // Ignorer les modules Node.js dans le bundle client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
      };
    }
    return config;
  },
};

export default nextConfig;
