import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const projectRoot = fileURLToPath(new URL('.', import.meta.url));

function resolveApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${resolveApiBaseUrl()}/api/:path*`,
      },
    ];
  },
  turbopack: {
    root: projectRoot,
  },
};

export default withNextIntl(nextConfig);
