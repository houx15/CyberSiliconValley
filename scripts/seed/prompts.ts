import {
  ALL_SKILLS,
  CHINESE_FAMILY_NAMES,
  CHINESE_GIVEN_NAMES,
  COMPANY_NAMES,
  SKILL_VOCABULARY,
} from './vocabulary';

export function buildTalentProfilePrompt(batch: {
  batchIndex: number;
  count: number;
  specialization: string;
  seniorityMix: string;
  backgroundMix: string;
  availabilityMix: string;
  existingNames: string[];
}): string {
  const skillList =
    SKILL_VOCABULARY[
      batch.specialization as keyof typeof SKILL_VOCABULARY
    ] ?? ALL_SKILLS;
  const crossDomainSkills = ALL_SKILLS.filter(
    (skill) => !skillList.includes(skill)
  ).slice(0, 30);
  const usedNamesClause =
    batch.existingNames.length > 0
      ? `\nAlready used names (DO NOT reuse): ${batch.existingNames.join(', ')}`
      : '';

  return `You are a data generator for an AI talent matching platform. Generate exactly ${batch.count} realistic Chinese AI professional profiles.

CRITICAL RULES:
1. All names MUST be realistic Chinese names (family name + given name, 2-3 Chinese characters total)
2. Use ONLY skills from this controlled vocabulary for primary skills: ${JSON.stringify(skillList)}
3. Cross-domain skills are allowed — pick 1-3 from other categories: ${crossDomainSkills.join(', ')}
4. Companies must be fictional Chinese companies — plausible but not real. Use names in this style: ${COMPANY_NAMES.slice(0, 10).join(', ')}
5. Candidate names must feel realistic. Family names to draw from: ${CHINESE_FAMILY_NAMES.slice(0, 20).join(' ')}. Given names to draw from: ${CHINESE_GIVEN_NAMES.slice(0, 24).join(' ')}
6. Project descriptions must be specific and technical, with metrics, scale, latency, or accuracy details
7. Each profile must feel like a distinct individual with a coherent career narrative
${usedNamesClause}

SPECIALIZATION: ${batch.specialization}
BATCH INDEX: ${batch.batchIndex}
SENIORITY DISTRIBUTION: ${batch.seniorityMix}
BACKGROUND DISTRIBUTION: ${batch.backgroundMix}
AVAILABILITY DISTRIBUTION: ${batch.availabilityMix}

Return a JSON array. Each element must follow this exact structure:
{
  "displayName": "张伟",
  "headline": "Senior NLP Engineer | RAG Pipeline Specialist",
  "bio": "5年NLP工程经验，专注于大规模检索增强生成系统。曾负责金融知识库与法律文档分析场景，擅长将向量检索、重排序和提示链路组合成稳定生产系统。",
  "skills": [
    { "name": "RAG Pipeline", "level": "expert", "category": "NLP/RAG" },
    { "name": "LangChain", "level": "advanced", "category": "NLP/RAG" },
    { "name": "Python", "level": "expert", "category": "Data Analysis/ML" }
  ],
  "experience": [
    {
      "company": "星辰智能科技",
      "role": "Senior NLP Engineer",
      "startDate": "2021-03",
      "endDate": "present",
      "duration": "2021-03 to present",
      "description": "Built a RAG pipeline processing 10K legal documents daily with 95% retrieval accuracy using LlamaIndex + Milvus. Reduced inference latency from 2.1s to 380ms through chunk optimization and hybrid search."
    }
  ],
  "education": [
    {
      "school": "北京大学",
      "degree": "硕士",
      "field": "计算机科学",
      "year": 2019
    }
  ],
  "goals": {
    "targetRoles": ["AI Architect", "Tech Lead"],
    "workPreference": "remote",
    "interests": ["Large-scale RAG systems", "Multi-agent orchestration"]
  },
  "availability": "open",
  "salaryRange": { "min": 40, "max": 60, "currency": "万/年" },
  "seniority": "senior",
  "background": "industry_engineer",
  "yearsOfExperience": 5
}

QUALITY CHECKLIST:
- 5-10 skills from the controlled vocabulary
- 1-3 experience entries with metrics, percentages, scale, throughput, or latency
- At least 1 education entry
- Bio in Chinese (2-4 technical sentences)
- Headline in English
- Salary in 万/年, realistic for the seniority
- Distinct personalities and project histories

Return ONLY the JSON array, no markdown fencing.`;
}

export function buildEnterpriseProfilePrompt(count: number): string {
  return `You are a data generator for an AI talent matching platform. Generate exactly ${count} realistic Chinese enterprise profiles.

CRITICAL RULES:
1. Company names must be fictional but plausible Chinese companies
2. Use names in this style: ${COMPANY_NAMES.join(', ')}
3. Mix company sizes: 4 startups (<50), 5 mid-size (50-500), 4 large (500-5000), 2 tech giants (5000+)
4. Mix industries: AI/ML, fintech, healthcare AI, autonomous driving, EdTech, e-commerce, enterprise SaaS, robotics, gaming AI, cybersecurity
5. AI maturity levels: exploring (3), adopting (5), scaling (4), leading (3)
6. Each company must have a distinct identity, realistic description, and credible hiring preferences

Return a JSON array. Each element:
{
  "companyName": "星辰智能科技",
  "industry": "AI/ML Platform",
  "companySize": "50-200",
  "website": "https://xingchen-ai.example.com",
  "description": "专注于企业级RAG解决方案的AI初创公司，为金融和法律行业提供智能文档处理平台。成立于2022年，已服务超过200家企业客户。",
  "aiMaturity": "scaling",
  "preferences": {
    "autoMatch": true,
    "autoPrechat": false,
    "dealBreakers": ["no_remote"],
    "preferredSeniority": ["mid", "senior"]
  }
}

Return ONLY the JSON array, no markdown fencing.`;
}

export function buildJobPostingsPrompt(enterprise: {
  companyName: string;
  industry: string;
  companySize: string;
  aiMaturity: string;
  jobCount: number;
}): string {
  return `You are a data generator for an AI talent matching platform. Generate exactly ${enterprise.jobCount} job postings for this company.

Company: ${enterprise.companyName}
Industry: ${enterprise.industry}
Size: ${enterprise.companySize}
AI Maturity: ${enterprise.aiMaturity}

CRITICAL RULES:
1. Skills MUST use ONLY these exact names from our controlled vocabulary: ${JSON.stringify(ALL_SKILLS)}
2. Each job must have 4-8 skills with required true/false
3. Job descriptions should be detailed (3-5 paragraphs) with specific project context
4. Seniority should match the company size and project scope
5. Budget uses the shape { "min": number, "max": number, "currency": "万/年" } and should clearly correspond to a budgetRange in 万/年
6. Timeline should be a plain string such as "Immediate start / full-time"
7. Deliverables should be a string array
8. Work mode must be one of remote, onsite, hybrid

Return a JSON array. Each element:
{
  "title": "Senior RAG Engineer",
  "description": "We are building a next-generation intelligent document processing platform for the financial industry...\\n\\nYou will work closely with our NLP research team to integrate hybrid retrieval, re-ranking, and streaming AI responses...\\n\\nKey responsibilities:\\n- Design and implement production RAG pipelines processing 1M+ documents\\n- Optimize retrieval accuracy and latency for enterprise SLA requirements\\n- Mentor junior engineers on architecture best practices",
  "structured": {
    "skills": [
      { "name": "RAG Pipeline", "level": "expert", "required": true },
      { "name": "LangChain", "level": "advanced", "required": true },
      { "name": "Vector Database", "level": "advanced", "required": true },
      { "name": "Python", "level": "expert", "required": true },
      { "name": "Semantic Search", "level": "advanced", "required": false }
    ],
    "seniority": "senior",
    "timeline": "Immediate start / full-time",
    "deliverables": ["Design retrieval architecture", "Ship production service", "Improve latency and accuracy"],
    "budget": { "min": 50, "max": 80, "currency": "万/年" },
    "workMode": "hybrid",
    "location": "北京"
  }
}

Return ONLY the JSON array, no markdown fencing.`;
}

export function buildMatchReasoningPrompt(
  talent: {
    displayName: string;
    headline: string;
    skills: Array<{ name: string; level: string }>;
    experience: Array<{ role: string; company: string; description: string }>;
  },
  job: {
    title: string;
    companyName: string;
    description: string;
    skills: Array<{ name: string; required: boolean }>;
  },
  score: number
): string {
  return `Analyze the match between this candidate and job posting. Write a concise 2-3 sentence compatibility analysis in Chinese.

CANDIDATE:
Name: ${talent.displayName}
Headline: ${talent.headline}
Skills: ${talent.skills.map((skill) => `${skill.name} (${skill.level})`).join(', ')}
Recent Experience: ${talent.experience[0]?.description ?? 'N/A'}

JOB:
Title: ${job.title} at ${job.companyName}
Required Skills: ${job.skills
    .filter((skill) => skill.required)
    .map((skill) => skill.name)
    .join(', ')}
Nice-to-have: ${job.skills
    .filter((skill) => !skill.required)
    .map((skill) => skill.name)
    .join(', ')}

MATCH SCORE: ${score}/100

Focus on:
1. Why the score is what it is
2. One strength and one concern
3. Keep it specific and professional

Return ONLY the analysis text, no JSON.`;
}

export function buildSeekingReportPrompt(
  talent: {
    displayName: string;
    headline: string;
    skills: Array<{ name: string; level: string }>;
    goals: { targetRoles?: string[]; interests?: string[] };
  },
  matches: Array<{
    jobTitle: string;
    companyName: string;
    score: number;
    matchedSkills: string[];
    missingSkills: string[];
  }>
): string {
  return `Generate a seeking report summary for this talent. Write in Chinese.

TALENT:
Name: ${talent.displayName}
Headline: ${talent.headline}
Target Roles: ${talent.goals.targetRoles?.join(', ') ?? '未设定'}
Interests: ${talent.goals.interests?.join(', ') ?? '未设定'}

RECENT MATCHES (${matches.length} total):
${matches
  .map(
    (match, index) => `${index + 1}. ${match.jobTitle} at ${match.companyName} — Score: ${match.score}/100
   Matched: ${match.matchedSkills.join(', ') || '无'}
   Missing: ${match.missingSkills.join(', ') || '无'}`
  )
  .join('\n')}

Generate a JSON report:
{
  "summary": "本周扫描了 X 个新职位，发现 Y 个高匹配度机会...",
  "highlights": ["highlight1", "highlight2"],
  "skillGaps": ["gap1", "gap2"],
  "marketInsight": "当前市场对 RAG 工程师需求旺盛...",
  "recommendations": ["recommendation1", "recommendation2"]
}

Return ONLY the JSON, no markdown fencing.`;
}

export function buildInboxMatchContent(
  type: 'talent_match' | 'enterprise_match' | 'invite' | 'prechat_summary',
  data: Record<string, unknown>
): { title: string; content: Record<string, unknown> } {
  switch (type) {
    case 'talent_match':
      return {
        title: `新匹配: ${String(data.jobTitle)} — ${String(data.companyName)}`,
        content: {
          type: 'match_notification',
          jobId: data.jobId,
          jobTitle: data.jobTitle,
          companyName: data.companyName,
          score: data.score,
          matchedSkills: data.matchedSkills,
          message: `您与「${String(data.companyName)}」的「${String(data.jobTitle)}」职位匹配度为 ${String(data.score)}%`,
        },
      };
    case 'enterprise_match':
      return {
        title: `新候选人: ${String(data.talentName)} — 匹配度 ${String(data.score)}%`,
        content: {
          type: 'match_notification',
          talentId: data.talentId,
          talentName: data.talentName,
          talentHeadline: data.talentHeadline,
          jobId: data.jobId,
          score: data.score,
          message: `「${String(data.talentName)}」与您的职位匹配度为 ${String(data.score)}%`,
        },
      };
    case 'invite':
      return {
        title: `面试邀请: ${String(data.companyName)} — ${String(data.jobTitle)}`,
        content: {
          type: 'invite',
          jobId: data.jobId,
          companyName: data.companyName,
          jobTitle: data.jobTitle,
          message:
            data.message ??
            `${String(data.companyName)} 邀请您参加「${String(data.jobTitle)}」职位的面试`,
        },
      };
    case 'prechat_summary':
      return {
        title: `AI 预聊天摘要: ${String(data.companyName)}`,
        content: {
          type: 'prechat_summary',
          jobId: data.jobId,
          companyName: data.companyName,
          jobTitle: data.jobTitle,
          summary: data.summary,
          highlights: data.highlights,
        },
      };
    default:
      return {
        title: '系统通知',
        content: { type: 'system', message: data.message ?? '系统通知' },
      };
  }
}
