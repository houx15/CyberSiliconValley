import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const CoachChat = vi.fn(() => <div data-testid="coach-chat" />);
const verifyJWT = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
let authTokenValue: string | null = 'mock-token';

vi.mock('@/components/coach/coach-chat', () => ({
  default: CoachChat,
}));

vi.mock('@/lib/auth', () => ({
  verifyJWT,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (key: string) =>
      key === 'auth-token' && authTokenValue
        ? {
            value: authTokenValue,
          }
        : null,
  }),
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

describe('CoachPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authTokenValue = 'mock-token';
  });

  it('redirects to login when there is no auth token', async () => {
    authTokenValue = null;

    const { default: CoachPage } = await import('../page');

    await expect(CoachPage()).rejects.toThrow('REDIRECT:/login');
    expect(verifyJWT).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/login');
    expect(CoachChat).not.toHaveBeenCalled();
  });

  it('renders the coach chat for an authenticated talent user', async () => {
    verifyJWT.mockResolvedValueOnce({
      userId: 'user-123',
      role: 'talent',
      email: 'talent@example.com',
    });

    const { default: CoachPage } = await import('../page');
    const markup = renderToStaticMarkup(await CoachPage());

    expect(verifyJWT).toHaveBeenCalledWith('mock-token');
    expect(redirect).not.toHaveBeenCalled();
    expect(CoachChat).toHaveBeenCalledTimes(1);
    expect(markup).toContain('data-testid="coach-chat"');
  });

  it('redirects to login when the token is invalid', async () => {
    verifyJWT.mockRejectedValueOnce(new Error('invalid token'));

    const { default: CoachPage } = await import('../page');

    await expect(CoachPage()).rejects.toThrow('REDIRECT:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
    expect(CoachChat).not.toHaveBeenCalled();
  });

  it('redirects to login when the user is not talent', async () => {
    verifyJWT.mockResolvedValueOnce({
      userId: 'user-123',
      role: 'enterprise',
      email: 'enterprise@example.com',
    });

    const { default: CoachPage } = await import('../page');

    await expect(CoachPage()).rejects.toThrow('REDIRECT:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
    expect(CoachChat).not.toHaveBeenCalled();
  });
});
