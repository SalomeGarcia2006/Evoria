import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@evoria/contracts'],
};

export default nextConfig;
