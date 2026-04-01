import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  MOCK_ENTERPRISE_INBOX_ITEMS,
  MOCK_ENTERPRISE_PROFILE,
  MOCK_JOBS,
  MOCK_JOB_MATCH_COUNTS,
} from '@/lib/mock-data';

const getCurrentEnterpriseProfile = vi.fn();
const listEnterpriseJobs = vi.fn();
const listOpenEnterpriseJobs = vi.fn();
const listInboxItemsByUserId = vi.fn();
const getCurrentUser = vi.fn();
const getTranslations = vi.fn();

const PageTransition = vi.fn(({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div data-testid="page-transition" data-classname={className}>
    {children}
  </div>
));
const ActivityStatus = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="activity-status" data-props={JSON.stringify(props)} />
));
const JobList = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="job-list" data-props={JSON.stringify(props)} />
));
const EmptyJobs = vi.fn(() => <div data-testid="empty-jobs" />);
const InboxList = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="inbox-list" data-props={JSON.stringify(props)} />
));
const EmptyInbox = vi.fn(() => <div data-testid="empty-inbox" />);
const ScreeningChat = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="screening-chat" data-props={JSON.stringify(props)} />
));
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock('@/lib/api/profile', () => ({
  getCurrentEnterpriseProfile,
}));

vi.mock('@/lib/api/jobs', () => ({
  listEnterpriseJobs,
  listOpenEnterpriseJobs,
}));

vi.mock('@/lib/api/inbox', () => ({
  listInboxItemsByUserId,
}));

vi.mock('@/lib/session/current-user', () => ({
  getCurrentUser,
}));

vi.mock('next-intl/server', () => ({
  getTranslations,
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

vi.mock('@/components/animations/page-transition', () => ({
  PageTransition,
}));

vi.mock('@/components/enterprise/activity-status', () => ({
  ActivityStatus,
}));

vi.mock('@/components/enterprise/job-list', () => ({
  JobList,
}));

vi.mock('@/components/empty-states/empty-jobs', () => ({
  EmptyJobs,
}));

vi.mock('@/components/inbox/inbox-list', () => ({
  InboxList,
}));

vi.mock('@/components/empty-states/empty-inbox', () => ({
  EmptyInbox,
}));

vi.mock('@/components/matching/screening-chat', () => ({
  ScreeningChat,
}));

function buildJobsWithCounts() {
  return MOCK_JOBS.map((job) => ({
    id: job.id,
    enterpriseId: job.enterpriseId,
    title: job.title,
    description: job.description,
    structured: job.structured,
    status: job.status,
    autoMatch: job.autoMatch,
    autoPrechat: job.autoPrechat,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    matchCount: MOCK_JOB_MATCH_COUNTS[job.id]?.matchCount ?? 0,
    shortlistedCount: MOCK_JOB_MATCH_COUNTS[job.id]?.shortlistedCount ?? 0,
  }));
}

describe('enterprise feature pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTranslations.mockResolvedValue((key: string) => (key === 'title' ? 'Inbox' : key));
    getCurrentUser.mockResolvedValue({
      id: MOCK_ENTERPRISE_PROFILE.userId,
      email: 'enterprise@example.com',
      role: 'enterprise',
    });
    listOpenEnterpriseJobs.mockImplementation((jobs) =>
      jobs
        .filter((job: { status: string }) => job.status === 'open')
        .map((job: { id: string; title: string | null }) => ({
          id: job.id,
          title: job.title || 'Untitled',
        }))
    );
  });

  it('dashboard page renders from enterprise profile and jobs api helpers', async () => {
    const jobs = buildJobsWithCounts();
    getCurrentEnterpriseProfile.mockResolvedValueOnce(MOCK_ENTERPRISE_PROFILE);
    listEnterpriseJobs.mockResolvedValueOnce(jobs);

    const { default: DashboardPage } = await import('../dashboard/page');
    const markup = renderToStaticMarkup(await DashboardPage());

    expect(getCurrentEnterpriseProfile).toHaveBeenCalled();
    expect(listEnterpriseJobs).toHaveBeenCalled();
    expect(ActivityStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        initial: expect.objectContaining({
          matchesFound: jobs.reduce((sum, job) => sum + job.matchCount, 0),
        }),
      }),
      undefined
    );
    expect(JobList).toHaveBeenCalledWith(
      expect.objectContaining({
        jobs: expect.arrayContaining([
          expect.objectContaining({
            id: jobs[0]?.id,
            title: jobs[0]?.title,
            matchCount: jobs[0]?.matchCount,
          }),
        ]),
      }),
      undefined
    );
    expect(markup).toContain('data-testid="activity-status"');
  });

  it('jobs page renders from the jobs api helper', async () => {
    const jobs = buildJobsWithCounts();
    listEnterpriseJobs.mockResolvedValueOnce(jobs);

    const { default: JobsPage } = await import('../jobs/page');
    const markup = renderToStaticMarkup(await JobsPage());

    expect(listEnterpriseJobs).toHaveBeenCalled();
    expect(JobList).toHaveBeenCalledWith(expect.objectContaining({ jobs }), undefined);
    expect(markup).toContain('data-testid="job-list"');
  });

  it('enterprise inbox page renders from the inbox api helper', async () => {
    listInboxItemsByUserId.mockResolvedValueOnce(MOCK_ENTERPRISE_INBOX_ITEMS);

    const { default: EnterpriseInboxPage } = await import('../inbox/page');
    const markup = renderToStaticMarkup(await EnterpriseInboxPage());

    expect(listInboxItemsByUserId).toHaveBeenCalled();
    expect(InboxList).toHaveBeenCalledWith(
      expect.objectContaining({ initialItems: MOCK_ENTERPRISE_INBOX_ITEMS }),
      undefined
    );
    expect(markup).toContain('data-testid="inbox-list"');
  });

  it('enterprise inbox page shows the empty state when no items exist', async () => {
    listInboxItemsByUserId.mockResolvedValueOnce([]);

    const { default: EnterpriseInboxPage } = await import('../inbox/page');
    const markup = renderToStaticMarkup(await EnterpriseInboxPage());

    expect(InboxList).not.toHaveBeenCalled();
    expect(markup).toContain('data-testid="empty-inbox"');
  });

  it('screening page renders from session and jobs api helpers', async () => {
    const jobs = buildJobsWithCounts();
    listEnterpriseJobs.mockResolvedValueOnce(jobs);

    const { default: ScreeningPage } = await import('../screening/page');
    const markup = renderToStaticMarkup(await ScreeningPage());

    expect(getCurrentUser).toHaveBeenCalled();
    expect(listEnterpriseJobs).toHaveBeenCalled();
    expect(ScreeningChat).toHaveBeenCalledWith(
      expect.objectContaining({
        activeJobs: jobs
          .filter((job) => job.status === 'open')
          .map((job) => ({ id: job.id, title: job.title || 'Untitled' })),
      }),
      undefined
    );
    expect(markup).toContain('data-testid="screening-chat"');
  });

  it('screening page redirects when the user is not an enterprise account', async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: 'talent-user',
      email: 'talent@example.com',
      role: 'talent',
    });

    const { default: ScreeningPage } = await import('../screening/page');

    await expect(ScreeningPage()).rejects.toThrow('REDIRECT:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
    expect(ScreeningChat).not.toHaveBeenCalled();
  });
});
