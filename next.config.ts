import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // API sin páginas: no se necesita el encabezado X-Powered-By
  poweredByHeader: false,
  // Se carga tal cual en Node (genera los PDF de las constancias); no se empaqueta.
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
