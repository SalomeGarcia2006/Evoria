import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: { agentUpgrade: 'security' },
  output: 'standalone',
  transpilePackages: ['@evoria/contracts'],
};

export default nextConfig;
