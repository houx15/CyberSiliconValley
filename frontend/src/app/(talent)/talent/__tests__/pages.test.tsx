import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { MOCK_SEEKING_REPORT, MOCK_TALENT_INBOX_ITEMS, MOCK_TALENT_PROFILE } from '@/lib/mock-data';

const getCurrentTalentProfile = vi.fn();
const listInboxItemsByUserId = vi.fn();
const getLatestReportByUserId = vi.fn();
const getTranslations = vi.fn();

const PageTransition = vi.fn(({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div data-testid="page-transition" data-classname={className}>
    {children}
  </div>
));

const ProfileHeader = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="profile-header" data-props={JSON.stringify(props)} />
));
const CapabilityPortrait = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="capability-portrait" data-props={JSON.stringify(props)} />
));
const ExperienceList = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="experience-list" data-props={JSON.stringify(props)} />
));
const ProfileEditor = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="profile-editor" data-props={JSON.stringify(props)} />
));
const InboxList = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="inbox-list" data-props={JSON.stringify(props)} />
));
const EmptyInbox = vi.fn(() => <div data-testid="empty-inbox" />);
const NoReport = vi.fn(() => <div data-testid="no-report" />);
const SeekingReportClient = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="seeking-report-client" data-props={JSON.stringify(props)} />
));

vi.mock('@/lib/api/profile', () => ({
  getCurrentTalentProfile,
}));

vi.mock('@/lib/api/inbox', () => ({
  listInboxItemsByUserId,
}));

vi.mock('@/lib/api/seeking', () => ({
  getLatestReportByUserId,
}));

vi.mock('next-intl/server', () => ({
  getTranslations,
}));

vi.mock('@/components/animations/page-transition', () => ({
  PageTransition,
}));

vi.mock('@/components/talent/profile-header', () => ({
  ProfileHeader,
}));

vi.mock('@/components/talent/capability-portrait', () => ({
  CapabilityPortrait,
}));

vi.mock('@/components/talent/experience-list', () => ({
  ExperienceList,
}));

vi.mock('@/components/talent/profile-editor', () => ({
  ProfileEditor,
}));

vi.mock('@/components/inbox/inbox-list', () => ({
  InboxList,
}));

vi.mock('@/components/empty-states/empty-inbox', () => ({
  EmptyInbox,
}));

vi.mock('@/components/empty-states/no-report', () => ({
  NoReport,
}));

vi.mock('@/components/seeking/seeking-report-client', () => ({
  SeekingReportClient,
}));

describe('talent feature pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTranslations.mockResolvedValue((key: string) => {
      const translations: Record<string, string> = {
        title: 'Inbox',
        noProfile: 'No profile found',
        skillsTitle: 'Skills',
        experienceTitle: 'Experience',
        backToHome: 'Back to home',
      };
      return translations[key] || key;
    });
  });

  it('home page renders from the profile api helper', async () => {
    getCurrentTalentProfile.mockResolvedValueOnce(MOCK_TALENT_PROFILE);

    const { default: TalentHomePage } = await import('../home/page');
    const markup = renderToStaticMarkup(await TalentHomePage());

    expect(getCurrentTalentProfile).toHaveBeenCalled();
    expect(ProfileHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: MOCK_TALENT_PROFILE.displayName,
        headline: MOCK_TALENT_PROFILE.headline,
      }),
      undefined
    );
    expect(CapabilityPortrait).toHaveBeenCalledWith(
      expect.objectContaining({ skills: MOCK_TALENT_PROFILE.skills }),
      undefined
    );
    expect(ExperienceList).toHaveBeenCalledWith(
      expect.objectContaining({ experience: MOCK_TALENT_PROFILE.experience }),
      undefined
    );
    expect(markup).toContain('data-testid="profile-header"');
  });

  it('profile editor page renders from the profile api helper', async () => {
    getCurrentTalentProfile.mockResolvedValueOnce(MOCK_TALENT_PROFILE);

    const { default: ProfileEditorPage } = await import('../profile/page');
    const markup = renderToStaticMarkup(await ProfileEditorPage());

    expect(getCurrentTalentProfile).toHaveBeenCalled();
    expect(ProfileEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        initial: expect.objectContaining({
          displayName: MOCK_TALENT_PROFILE.displayName,
          skills: MOCK_TALENT_PROFILE.skills,
        }),
      }),
      undefined
    );
    expect(markup).toContain('data-testid="profile-editor"');
  });

  it('talent inbox page renders from the inbox api helper', async () => {
    listInboxItemsByUserId.mockResolvedValueOnce(MOCK_TALENT_INBOX_ITEMS);

    const { default: TalentInboxPage } = await import('../inbox/page');
    const markup = renderToStaticMarkup(await TalentInboxPage());

    expect(listInboxItemsByUserId).toHaveBeenCalled();
    expect(InboxList).toHaveBeenCalledWith(
      expect.objectContaining({ initialItems: MOCK_TALENT_INBOX_ITEMS }),
      undefined
    );
    expect(markup).toContain('data-testid="inbox-list"');
  });

  it('talent inbox page shows the empty state when no items exist', async () => {
    listInboxItemsByUserId.mockResolvedValueOnce([]);

    const { default: TalentInboxPage } = await import('../inbox/page');
    const markup = renderToStaticMarkup(await TalentInboxPage());

    expect(InboxList).not.toHaveBeenCalled();
    expect(markup).toContain('data-testid="empty-inbox"');
  });

  it('seeking page renders from the seeking and profile api helpers', async () => {
    getLatestReportByUserId.mockResolvedValueOnce(MOCK_SEEKING_REPORT);
    getCurrentTalentProfile.mockResolvedValueOnce(MOCK_TALENT_PROFILE);

    const { default: SeekingPage } = await import('../seeking/page');
    const markup = renderToStaticMarkup(await SeekingPage());

    expect(getLatestReportByUserId).toHaveBeenCalled();
    expect(getCurrentTalentProfile).toHaveBeenCalled();
    expect(SeekingReportClient).toHaveBeenCalledWith(
      expect.objectContaining({
        initialReport: MOCK_SEEKING_REPORT,
        talentId: MOCK_TALENT_PROFILE.id,
      }),
      undefined
    );
    expect(markup).toContain('data-testid="seeking-report-client"');
  });

  it('seeking page shows the no-report state when the backend returns no report', async () => {
    getLatestReportByUserId.mockResolvedValueOnce(null);
    getCurrentTalentProfile.mockResolvedValueOnce(MOCK_TALENT_PROFILE);

    const { default: SeekingPage } = await import('../seeking/page');
    const markup = renderToStaticMarkup(await SeekingPage());

    expect(SeekingReportClient).not.toHaveBeenCalled();
    expect(markup).toContain('data-testid="no-report"');
  });
});
