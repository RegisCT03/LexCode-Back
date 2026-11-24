import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // API sin páginas: no se necesita el encabezado X-Powered-By
  poweredByHeader: false,
};

export default nextConfig;
