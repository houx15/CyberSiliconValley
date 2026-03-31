import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const CoachChat = vi.fn(() => <div data-testid="coach-chat" />);
const getCurrentUser = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock('@/components/coach/coach-chat', () => ({
  default: CoachChat,
}));

vi.mock('@/lib/session/current-user', () => ({
  getCurrentUser,
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

describe('CoachPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to login when there is no authenticated user', async () => {
    getCurrentUser.mockResolvedValueOnce(null);

    const { default: CoachPage } = await import('../page');

    await expect(CoachPage()).rejects.toThrow('REDIRECT:/login');
    expect(getCurrentUser).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/login');
    expect(CoachChat).not.toHaveBeenCalled();
  });

  it('renders the coach chat for an authenticated talent user', async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: 'user-123',
      role: 'talent',
      email: 'talent@example.com',
    });

    const { default: CoachPage } = await import('../page');
    const markup = renderToStaticMarkup(await CoachPage());

    expect(getCurrentUser).toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(CoachChat).toHaveBeenCalledTimes(1);
    expect(markup).toContain('data-testid="coach-chat"');
  });

  it('redirects to login when session loading fails', async () => {
    getCurrentUser.mockRejectedValueOnce(new Error('session unavailable'));

    const { default: CoachPage } = await import('../page');

    await expect(CoachPage()).rejects.toThrow('REDIRECT:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
    expect(CoachChat).not.toHaveBeenCalled();
  });

  it('redirects to login when the user is not talent', async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: 'user-123',
      role: 'enterprise',
      email: 'enterprise@example.com',
    });

    const { default: CoachPage } = await import('../page');

    await expect(CoachPage()).rejects.toThrow('REDIRECT:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
    expect(CoachChat).not.toHaveBeenCalled();
  });
});
