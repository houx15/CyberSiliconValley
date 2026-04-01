import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const getCurrentUser = vi.fn();
const getCurrentEnterpriseProfile = vi.fn();
const OnboardingChat = vi.fn(() => <div data-testid="onboarding-chat" />);
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock('@/lib/session/current-user', () => ({
  getCurrentUser,
}));

vi.mock('@/lib/api/profile', () => ({
  getCurrentEnterpriseProfile,
}));

vi.mock('@/components/enterprise/onboarding-chat', () => ({
  OnboardingChat,
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

describe('EnterpriseOnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({
      id: 'enterprise-user',
      email: 'enterprise@example.com',
      role: 'enterprise',
    });
    getCurrentEnterpriseProfile.mockResolvedValue({
      onboardingDone: false,
    });
  });

  it('renders the onboarding chat for an enterprise user that is not onboarded', async () => {
    const { default: EnterpriseOnboardingPage } = await import('../page');
    const markup = renderToStaticMarkup(await EnterpriseOnboardingPage());

    expect(getCurrentUser).toHaveBeenCalled();
    expect(getCurrentEnterpriseProfile).toHaveBeenCalled();
    expect(markup).toContain('data-testid="onboarding-chat"');
  });

  it('redirects to login when there is no authenticated user', async () => {
    getCurrentUser.mockResolvedValueOnce(null);

    const { default: EnterpriseOnboardingPage } = await import('../page');

    await expect(EnterpriseOnboardingPage()).rejects.toThrow('REDIRECT:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('redirects to the dashboard when onboarding is already complete', async () => {
    getCurrentEnterpriseProfile.mockResolvedValueOnce({ onboardingDone: true });

    const { default: EnterpriseOnboardingPage } = await import('../page');

    await expect(EnterpriseOnboardingPage()).rejects.toThrow('REDIRECT:/enterprise/dashboard');
    expect(redirect).toHaveBeenCalledWith('/enterprise/dashboard');
  });
});
