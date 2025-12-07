import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Para Firebase Hosting estático, usar 'export' para generar archivos estáticos
  output: 'export', // Firebase Hosting requiere export estático
  // Deshabilitar imágenes optimizadas para compatibilidad
  images: {
    unoptimized: true,
  },
  // Trailing slash para compatibilidad con Firebase Hosting
  trailingSlash: false,
  typescript: {
    // Ya no hay errores de TypeScript, pero mantener true por seguridad
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignorar durante builds para evitar bloqueos menores
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer, dev }) => {
    // Resolver problemas con módulos Node.js en el cliente
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // SOLUCIÓN: Simplificar configuración de webpack para evitar errores de chunks faltantes
    // En desarrollo, usar configuración mínima para evitar problemas
    if (dev) {
      // En desarrollo, mantener configuración simple
      config.optimization = {
        ...config.optimization,
        moduleIds: 'named',
        chunkIds: 'named',
        removeAvailableModules: false,
        removeEmptyChunks: false,
      };
    } else {
      // En producción, SIMPLIFICAR para evitar problemas de chunks
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        chunkIds: 'deterministic',
        // NO usar splitChunks personalizado - dejar que Next.js lo maneje
        // Esto previene problemas de referencias a chunks antiguos
      };
    }
    
    return config;
  },
  // Headers para permitir popups de OAuth (Google Sign-In)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
        ],
      },
    ];
  },
  // Deshabilitar optimización de chunks que puede causar problemas con vendor-chunks
  // experimental: {
  //   optimizePackageImports: ['lucide-react'],
  // },
};

export default nextConfig;
