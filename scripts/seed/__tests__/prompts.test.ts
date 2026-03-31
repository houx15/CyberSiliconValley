import { describe, expect, it } from 'vitest';

import {
  buildEnterpriseProfilePrompt,
  buildInboxMatchContent,
  buildJobPostingsPrompt,
  buildMatchReasoningPrompt,
  buildSeekingReportPrompt,
  buildTalentProfilePrompt,
} from '../prompts';

describe('seed prompts', () => {
  it('builds the talent profile prompt with batch context and vocabulary guidance', () => {
    const prompt = buildTalentProfilePrompt({
      batchIndex: 2,
      count: 10,
      specialization: 'NLP/RAG',
      seniorityMix: 'mostly senior',
      backgroundMix: 'mixed',
      availabilityMix: 'mostly open',
      existingNames: ['张伟', '王芳'],
    });

    expect(prompt).toContain('Generate exactly 10 realistic Chinese AI professional profiles');
    expect(prompt).toContain('SPECIALIZATION: NLP/RAG');
    expect(prompt).toContain('Already used names (DO NOT reuse): 张伟, 王芳');
    expect(prompt).toContain('RAG Pipeline');
    expect(prompt).toContain('Return ONLY the JSON array');
  });

  it('builds the enterprise prompt with size and maturity distribution guidance', () => {
    const prompt = buildEnterpriseProfilePrompt(15);

    expect(prompt).toContain('Generate exactly 15 realistic Chinese enterprise profiles');
    expect(prompt).toContain('Mix company sizes');
    expect(prompt).toContain('AI maturity levels');
    expect(prompt).toContain('Return ONLY the JSON array');
  });

  it('builds the job prompt with company context and skill constraints', () => {
    const prompt = buildJobPostingsPrompt({
      companyName: '星辰智能科技',
      industry: 'AI/ML Platform',
      companySize: '50-200',
      aiMaturity: 'scaling',
      jobCount: 3,
    });

    expect(prompt).toContain('Company: 星辰智能科技');
    expect(prompt).toContain('Generate exactly 3 job postings');
    expect(prompt).toContain('Skills MUST use ONLY these exact names');
    expect(prompt).toContain('Budget uses the shape');
  });

  it('builds the match reasoning prompt with candidate/job specifics', () => {
    const prompt = buildMatchReasoningPrompt(
      {
        displayName: '张伟',
        headline: 'Senior RAG Engineer',
        skills: [{ name: 'RAG Pipeline', level: 'expert' }],
        experience: [
          {
            role: 'Senior NLP Engineer',
            company: '星辰智能科技',
            description: 'Built a legal RAG pipeline for 10K docs/day.',
          },
        ],
      },
      {
        title: 'Senior RAG Engineer',
        companyName: '灵犀AI',
        description: 'Build production retrieval systems',
        skills: [{ name: 'RAG Pipeline', required: true }],
      },
      92
    );

    expect(prompt).toContain('MATCH SCORE: 92/100');
    expect(prompt).toContain('Required Skills: RAG Pipeline');
    expect(prompt).toContain('Return ONLY the analysis text');
  });

  it('builds the seeking report prompt with summary JSON expectations', () => {
    const prompt = buildSeekingReportPrompt(
      {
        displayName: '张伟',
        headline: 'Senior RAG Engineer',
        skills: [{ name: 'RAG Pipeline', level: 'expert' }],
        goals: {
          targetRoles: ['AI Architect'],
          interests: ['Large-scale RAG systems'],
        },
      },
      [
        {
          jobTitle: 'Senior RAG Engineer',
          companyName: '灵犀AI',
          score: 91,
          matchedSkills: ['RAG Pipeline'],
          missingSkills: ['LangGraph'],
        },
      ]
    );

    expect(prompt).toContain('RECENT MATCHES (1 total)');
    expect(prompt).toContain('"summary"');
    expect(prompt).toContain('Return ONLY the JSON');
  });

  it('builds inbox content payloads for supported seed notification types', () => {
    const talentMatch = buildInboxMatchContent('talent_match', {
      jobId: 'job-1',
      jobTitle: 'Senior RAG Engineer',
      companyName: '灵犀AI',
      score: 91,
      matchedSkills: ['RAG Pipeline'],
    });
    const enterpriseMatch = buildInboxMatchContent('enterprise_match', {
      talentId: 'talent-1',
      talentName: '张伟',
      talentHeadline: 'Senior RAG Engineer',
      jobId: 'job-1',
      score: 91,
    });

    expect(talentMatch.title).toContain('Senior RAG Engineer');
    expect(talentMatch.content.type).toBe('match_notification');
    expect(enterpriseMatch.title).toContain('张伟');
    expect(enterpriseMatch.content.talentHeadline).toBe('Senior RAG Engineer');
  });
});
