import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CoachModeTabs from '../coach-mode-tabs';
import GapAnalysisCard from '../gap-analysis-card';
import BeforeAfterCard from '../before-after-card';

describe('coach components', () => {
  it('renders the coach mode tabs', () => {
    const markup = renderToStaticMarkup(
      <CoachModeTabs mode="resume-review" onModeChange={() => undefined} />
    );

    expect(markup).toContain('aria-label="Chat"');
    expect(markup).toContain('aria-label="Resume Review"');
    expect(markup).toContain('aria-label="Mock Interview"');
    expect(markup).toContain('aria-label="Skill Gaps"');
    expect(markup).toContain('Chat');
    expect(markup).toContain('Resume Review');
    expect(markup).toContain('Mock Interview');
    expect(markup).toContain('Skill Gaps');
  });

  it('renders a gap analysis card with priority styling', () => {
    const markup = renderToStaticMarkup(
      <GapAnalysisCard
        skillName="Prompt Engineering"
        reason="This skill will help you turn product goals into better AI instructions."
        priority="Critical"
      />
    );

    expect(markup).toContain('Prompt Engineering');
    expect(markup).toContain('Critical');
    expect(markup).toContain('turn product goals');
  });

  it('renders a before/after card', () => {
    const markup = renderToStaticMarkup(
      <BeforeAfterCard
        field="Headline"
        before="Building AI products"
        after="Building AI products that help enterprise teams ship faster"
      />
    );

    expect(markup).toContain('Headline');
    expect(markup).toContain('Before');
    expect(markup).toContain('After');
    expect(markup).toContain('ship faster');
  });

  it('renders the coach chat empty state', async () => {
    const { default: CoachChat } = await import('../coach-chat');
    const markup = renderToStaticMarkup(<CoachChat />);

    expect(markup).toContain('AI Coach');
    expect(markup).toContain('Career guidance that can rewrite, recommend, and rehearse with you');
    expect(markup).toContain('Chat with your AI career coach');
  });

  it('stops the active stream before resetting chat state on mode change', async () => {
    const { default: CoachChat, resetCoachConversation } = await import('../coach-chat');

    const stop = vi.fn();
    const setMode = vi.fn();
    const setMessages = vi.fn();
    const setInput = vi.fn();

    resetCoachConversation(stop, setMode, setMessages, setInput, 'skill-gaps');

    expect(stop).toHaveBeenCalledTimes(1);
    expect(setMode).toHaveBeenCalledWith('skill-gaps');
    expect(setMessages).toHaveBeenCalledWith([]);
    expect(setInput).toHaveBeenCalledWith('');

    expect(typeof CoachChat).toBe('function');
  });
});
