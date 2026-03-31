import { beforeEach, describe, expect, it, vi } from 'vitest';
import middleware from '@/middleware';

vi.mock('next/server', () => ({
  NextResponse: {
    next: (init?: { request?: { headers?: Headers } }) => ({
      _type: 'next',
      headers: init?.request?.headers ?? new Headers(),
    }),
    redirect: (url: URL) => ({
      _type: 'redirect',
      _url: url.pathname,
    }),
  },
}));

function makeRequest(path: string, token?: string) {
  const url = `http://localhost${path}`;
  return {
    nextUrl: { pathname: path, origin: 'http://localhost' },
    url,
    headers: new Headers(token ? { cookie: `auth-token=${token}` } : {}),
    cookies: {
      get: (name: string) => {
        if (name === 'auth-token' && token) {
          return { value: token };
        }
        return undefined;
      },
    },
  } as unknown as import('next/server').NextRequest;
}

describe('middleware', () => {
  describe('public routes pass through without auth', () => {
    it('allows / without auth', async () => {
      const req = makeRequest('/');
      const res = await middleware(req);
      expect((res as any)._type).toBe('next');
    });

    it('allows /login without auth', async () => {
      const req = makeRequest('/login');
      const res = await middleware(req);
      expect((res as any)._type).toBe('next');
    });

    it('allows /login/callback without auth', async () => {
      const req = makeRequest('/login/callback');
      const res = await middleware(req);
      expect((res as any)._type).toBe('next');
    });

    it('allows /api/v1/auth/login without auth', async () => {
      const req = makeRequest('/api/v1/auth/login');
      const res = await middleware(req);
      expect((res as any)._type).toBe('next');
    });
  });

  describe('unauthenticated requests to protected routes', () => {
    it('redirects unauthenticated request to /talent/dashboard', async () => {
      const req = makeRequest('/talent/dashboard');
      const res = await middleware(req);
      expect((res as any)._type).toBe('redirect');
      expect((res as any)._url).toBe('/login');
    });

    it('redirects unauthenticated request to /enterprise/dashboard', async () => {
      const req = makeRequest('/enterprise/dashboard');
      const res = await middleware(req);
      expect((res as any)._type).toBe('redirect');
      expect((res as any)._url).toBe('/login');
    });

    it('redirects unauthenticated request to /settings', async () => {
      const req = makeRequest('/settings');
      const res = await middleware(req);
      expect((res as any)._type).toBe('redirect');
      expect((res as any)._url).toBe('/login');
    });
  });

  describe('role-based routing from backend session', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('allows talent user to access /talent/dashboard', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { id: 'user-1', role: 'talent', email: 'talent@csv.dev' } }))
      );
      const req = makeRequest('/talent/dashboard', 'token-1');
      const res = await middleware(req);
      expect((res as any)._type).toBe('next');
      expect((res as any).headers.get('x-user-id')).toBe('user-1');
    });

    it('redirects talent user away from /enterprise/dashboard', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { id: 'user-1', role: 'talent', email: 'talent@csv.dev' } }))
      );
      const req = makeRequest('/enterprise/dashboard', 'token-1');
      const res = await middleware(req);
      expect((res as any)._type).toBe('redirect');
      expect((res as any)._url).toBe('/login');
    });
  });

  describe('backend session failures', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('redirects when backend session returns unauthorized', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'UNAUTH' }), { status: 401 }));
      const req = makeRequest('/talent/dashboard', 'token-1');
      const res = await middleware(req);
      expect((res as any)._type).toBe('redirect');
      expect((res as any)._url).toBe('/login');
    });

    it('redirects when backend session fetch throws', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('network'));
      const req = makeRequest('/talent/dashboard', 'token-1');
      const res = await middleware(req);
      expect((res as any)._type).toBe('redirect');
      expect((res as any)._url).toBe('/login');
    });
  });
});
