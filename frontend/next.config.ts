import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Configuration Turbopack (Next.js 16+)
  turbopack: {},
  
  webpack: (config, { isServer }) => {
    // Ne pas bundler @techstark/opencv-js (non installé - optionnel, fallbacks en place)
    // ⚠️ NE PAS utiliser externals avec string pour les modules scoped '@...' :
    //    `'@techstark/opencv-js'` génère `module.exports = @techstark/opencv-js`
    //    qui est du JS invalide (SyntaxError car '@' n'est pas un identifiant valide)
    // ✅ Utiliser un mock vide pour éviter l'erreur "Module not found"
    config.resolve.alias = {
      ...config.resolve.alias,
      '@techstark/opencv-js': path.resolve(__dirname, 'src/mocks/opencv-js-empty.js'),
    };

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
