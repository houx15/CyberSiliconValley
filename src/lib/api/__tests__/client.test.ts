import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, apiPost } from '../client';

const headersMock = vi.fn();
const cookiesMock = vi.fn();

vi.mock('next/headers', () => ({
  headers: headersMock,
  cookies: cookiesMock,
}));

describe('api client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    headersMock.mockResolvedValue({
      get: (key: string) => {
        if (key === 'host') return 'csv.test';
        if (key === 'x-forwarded-proto') return 'https';
        return null;
      },
    });
    cookiesMock.mockResolvedValue({
      toString: () => 'auth-token=abc123',
    });
  });

  it('forwards cookies on server-side requests', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 })
    );

    const result = await apiFetch<{ data: { ok: boolean } }>('/api/v1/test');

    expect(result.data.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://csv.test/api/v1/test',
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const requestHeaders = init?.headers as Headers;
    expect(requestHeaders.get('cookie')).toBe('auth-token=abc123');
  });

  it('serializes json bodies for posts', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: '1' } }), { status: 200 })
    );

    await apiPost('/api/v1/auth/login', { email: 'talent1@csv.dev', password: 'csv2026' });

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ email: 'talent1@csv.dev', password: 'csv2026' }));
    const requestHeaders = init?.headers as Headers;
    expect(requestHeaders.get('content-type')).toBe('application/json');
  });

  it('normalizes api errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'INVALID', message: 'Nope' }), { status: 401 })
    );

    await expect(apiFetch('/api/v1/auth/session')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      message: 'Nope',
    } satisfies Partial<ApiError>);
  });
});
