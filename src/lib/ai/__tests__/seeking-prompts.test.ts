import { describe, expect, it } from 'vitest';
import { buildAssessmentPrompt } from '../prompts/seeking-assessment';
import { buildTailoredResumePrompt } from '../prompts/tailored-resume';
import { buildPreChatPrompt } from '../prompts/pre-chat';

const profile = {
  displayName: '陈明远',
  headline: '资深 AI 工程师',
  bio: '负责 RAG 和 Agent 系统落地。',
  skills: [
    { name: 'RAG Pipeline', level: 'expert', category: 'AI/ML' },
    { name: 'TypeScript', level: 'advanced', category: 'Languages' },
  ],
  experience: [
    {
      role: 'AI 架构师',
      company: '星图智能',
      duration: '2023 - 至今',
      description: '设计企业级检索增强系统并带领团队交付。',
    },
  ],
  education: [
    { degree: '硕士', institution: '清华大学', year: '2018' },
  ],
  goals: {
    targetRoles: ['AI 架构师'],
    workPreferences: ['远程优先'],
  },
  availability: 'open',
  salaryRange: {
    min: 50000,
    max: 70000,
    currency: 'CNY',
  },
};

const job = {
  title: '高级 RAG 工程师',
  companyName: '星辰智能科技',
  description: '负责企业级 RAG 系统建设。',
  structured: {
    skills: [
      { name: 'RAG Pipeline', required: true, level: 'expert' },
      { name: 'TypeScript', required: false, level: 'advanced' },
    ],
    seniority: 'Senior',
    workMode: 'hybrid',
  },
};

describe('seeking prompts', () => {
  it('assessment prompt references concrete fit analysis', () => {
    const prompt = buildAssessmentPrompt(profile, job, 92);

    expect(prompt).toContain('92/100');
    expect(prompt).toMatch(/specific/i);
    expect(prompt).toContain('RAG Pipeline');
    expect(prompt).toContain('星辰智能科技');
  });

  it('tailored resume prompt requires markdown output', () => {
    const prompt = buildTailoredResumePrompt(profile, job);

    expect(prompt).toMatch(/markdown/i);
    expect(prompt).toMatch(/reorder/i);
    expect(prompt).toContain('Summary');
    expect(prompt).toContain('高级 RAG 工程师');
  });

  it('pre-chat prompt requires structured sections', () => {
    const prompt = buildPreChatPrompt(profile, job, 88);

    expect(prompt).toContain('### Key Findings');
    expect(prompt).toContain('### Compatibility Assessment');
    expect(prompt).toContain('### Recommended Next Steps');
    expect(prompt).toContain('### Candidate Sentiment');
  });
});
