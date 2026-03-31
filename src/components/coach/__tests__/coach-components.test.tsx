import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CoachModeTabs from '../coach-mode-tabs';
import GapAnalysisCard from '../gap-analysis-card';
import BeforeAfterCard from '../before-after-card';

const mockUseChat = vi.fn();

vi.mock('@ai-sdk/react', () => ({
  useChat: mockUseChat,
}));

vi.mock('ai', () => ({
  TextStreamChatTransport: class TextStreamChatTransport {
    constructor(public options: Record<string, unknown>) {}
  },
}));

describe('coach components', () => {
  beforeEach(() => {
    mockUseChat.mockReset();
  });

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

  it('renders the coach chat empty state and tool results from UI message parts', async () => {
    mockUseChat.mockReturnValue({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Suggested rewrite:\nBEFORE: I build AI systems.\nAFTER: I design and ship enterprise AI systems that improve team throughput.',
            },
            {
              type: 'tool-suggestSkill',
              state: 'output-available',
              toolCallId: 'tool-1',
              input: { name: 'Prompt Engineering', reason: 'Needed for better model instructions.' },
              output: {
                success: true,
                suggestion: {
                  name: 'Prompt Engineering',
                  reason: 'Needed for better model instructions.',
                },
                message: 'Suggested skill: Prompt Engineering',
              },
            },
            {
              type: 'tool-updateProfileField',
              state: 'output-available',
              toolCallId: 'tool-2',
              input: { field: 'headline', value: 'AI Product Builder' },
              output: {
                success: true,
                message: 'Headline updated',
              },
            },
          ],
        },
      ],
      sendMessage: vi.fn(),
      status: 'ready',
      setMessages: vi.fn(),
    });

    const { default: CoachChat } = await import('../coach-chat');
    const markup = renderToStaticMarkup(<CoachChat />);

    expect(markup).toContain('AI Coach');
    expect(markup).toContain('Career guidance that can rewrite, recommend, and rehearse with you');
    expect(markup).toContain('Suggested rewrite');
    expect(markup).toContain('Prompt Engineering');
    expect(markup).toContain('Headline');
    expect(markup).toContain('AI Product Builder');
  });

  it('stops the active stream before resetting chat state on mode change', async () => {
    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      status: 'streaming',
      setMessages: vi.fn(),
      stop: vi.fn(),
    });

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
