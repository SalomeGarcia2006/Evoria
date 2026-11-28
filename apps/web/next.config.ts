import type { NextConfig } from 'next';

const upstream = process.env.VERCEL
  ? process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '')
  : undefined;

const nextConfig: NextConfig = {
  ...(process.env.EVORIA_PROVIDER_LOCAL === '1' && {
    distDir: '../../tmp/provider-next-build',
  }),
  ...(upstream?.startsWith('https://') && {
    env: { NEXT_PUBLIC_API_URL: '/api' },
    async rewrites() {
      return [{ source: '/api/:path*', destination: `${upstream}/:path*` }];
    },
    async headers() {
      return [
        {
          source: '/api/:path*',
          headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
        },
      ];
    },
  }),
  experimental: { agentUpgrade: 'security' },
  output: 'standalone',
  transpilePackages: ['@evoria/contracts', 'leaflet'],
};

export default nextConfig;
