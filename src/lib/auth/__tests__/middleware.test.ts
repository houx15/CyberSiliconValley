import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthMiddleware } from '../middleware';
import { signJWT } from '../index';

// Minimal NextResponse mock
const mockNextResponseNext = vi.fn();
const mockNextResponseRedirect = vi.fn();
const mockHeadersSet = vi.fn();

vi.mock('next/server', () => {
  return {
    NextResponse: {
      next: () => {
        const headers = new Map<string, string>();
        return {
          headers: {
            set: (key: string, value: string) => headers.set(key, value),
            get: (key: string) => headers.get(key),
          },
          _type: 'next',
          _headers: headers,
        };
      },
      redirect: (url: URL) => ({
        _type: 'redirect',
        _url: url.pathname,
      }),
    },
  };
});

function makeRequest(path: string, token?: string) {
  const url = `http://localhost${path}`;
  return {
    nextUrl: { pathname: path },
    url,
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

describe('createAuthMiddleware', () => {
  const middleware = createAuthMiddleware();

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

    it('allows /api/v1/auth/register without auth', async () => {
      const req = makeRequest('/api/v1/auth/register');
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

  describe('role-based routing for talent users', () => {
    let talentToken: string;

    beforeEach(async () => {
      talentToken = await signJWT({ userId: 'user-1', role: 'talent', email: 'talent@csv.dev' });
    });

    it('allows talent user to access /talent/dashboard', async () => {
      const req = makeRequest('/talent/dashboard', talentToken);
      const res = await middleware(req);
      expect((res as any)._type).toBe('next');
    });

    it('allows talent user to access /talent/profile', async () => {
      const req = makeRequest('/talent/profile', talentToken);
      const res = await middleware(req);
      expect((res as any)._type).toBe('next');
    });

    it('redirects talent user away from /enterprise/dashboard', async () => {
      const req = makeRequest('/enterprise/dashboard', talentToken);
      const res = await middleware(req);
      expect((res as any)._type).toBe('redirect');
      expect((res as any)._url).toBe('/login');
    });
  });

  describe('role-based routing for enterprise users', () => {
    let enterpriseToken: string;

    beforeEach(async () => {
      enterpriseToken = await signJWT({ userId: 'user-2', role: 'enterprise', email: 'enterprise@csv.dev' });
    });

    it('allows enterprise user to access /enterprise/dashboard', async () => {
      const req = makeRequest('/enterprise/dashboard', enterpriseToken);
      const res = await middleware(req);
      expect((res as any)._type).toBe('next');
    });

    it('allows enterprise user to access /enterprise/jobs', async () => {
      const req = makeRequest('/enterprise/jobs', enterpriseToken);
      const res = await middleware(req);
      expect((res as any)._type).toBe('next');
    });

    it('redirects enterprise user away from /talent/dashboard', async () => {
      const req = makeRequest('/talent/dashboard', enterpriseToken);
      const res = await middleware(req);
      expect((res as any)._type).toBe('redirect');
      expect((res as any)._url).toBe('/login');
    });
  });

  describe('auth headers are set on authenticated requests', () => {
    it('sets x-user-id, x-user-role, x-user-email headers for talent', async () => {
      const token = await signJWT({ userId: 'user-42', role: 'talent', email: 'talent@csv.dev' });
      const req = makeRequest('/talent/dashboard', token);
      const res = await middleware(req) as any;

      expect(res._type).toBe('next');
      expect(res.headers.get('x-user-id')).toBe('user-42');
      expect(res.headers.get('x-user-role')).toBe('talent');
      expect(res.headers.get('x-user-email')).toBe('talent@csv.dev');
    });

    it('sets x-user-id, x-user-role, x-user-email headers for enterprise', async () => {
      const token = await signJWT({ userId: 'user-99', role: 'enterprise', email: 'corp@csv.dev' });
      const req = makeRequest('/enterprise/jobs', token);
      const res = await middleware(req) as any;

      expect(res._type).toBe('next');
      expect(res.headers.get('x-user-id')).toBe('user-99');
      expect(res.headers.get('x-user-role')).toBe('enterprise');
      expect(res.headers.get('x-user-email')).toBe('corp@csv.dev');
    });
  });
});
