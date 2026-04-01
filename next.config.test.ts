import { afterEach, describe, expect, it } from 'vitest';
import nextConfig from './next.config';

describe('next config', () => {
  const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  afterEach(() => {
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
  });

  it('proxies api requests to the configured backend origin', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:8000/';

    expect(nextConfig.rewrites).toBeTypeOf('function');
    await expect(nextConfig.rewrites?.()).resolves.toEqual([
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]);
  });
});
