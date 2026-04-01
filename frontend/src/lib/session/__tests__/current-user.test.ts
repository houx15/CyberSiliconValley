import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser, loginWithPassword } from '../current-user';

const { apiFetch, apiPost } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiFetch,
    apiPost,
  };
});

describe('current user session helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the backend session is unauthenticated', async () => {
    const { ApiError } = await import('@/lib/api/client');
    apiFetch.mockRejectedValueOnce(new ApiError(401, { message: 'Not authenticated' }));

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('returns the authenticated user from the backend session', async () => {
    apiFetch.mockResolvedValueOnce({
      user: {
        id: 'talent-1',
        email: 'talent1@csv.dev',
        role: 'talent',
      },
    });

    await expect(getCurrentUser()).resolves.toEqual({
      id: 'talent-1',
      email: 'talent1@csv.dev',
      role: 'talent',
    });
  });

  it('posts credentials to backend login', async () => {
    apiPost.mockResolvedValueOnce({
      user: {
        id: 'enterprise-1',
        email: 'enterprise1@csv.dev',
        role: 'enterprise',
      },
    });

    const result = await loginWithPassword('enterprise1@csv.dev', 'csv2026');

    expect(apiPost).toHaveBeenCalledWith('/api/v1/auth/login', {
      email: 'enterprise1@csv.dev',
      password: 'csv2026',
    });
    expect(result.role).toBe('enterprise');
  });
});
