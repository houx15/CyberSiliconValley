import { buildSystemPrompt } from './_base';

export function buildPreChatPrompt(
  talentProfile: {
    displayName: string;
    headline: string;
    skills: Array<{ name: string; level: string; category?: string }>;
    experience: Array<{ role: string; company: string; description: string }>;
    goals?: { targetRoles?: string[]; workPreferences?: string[] };
    availability: string;
    salaryRange?: { min?: number; max?: number; currency?: string } | null;
  },
  job: {
    title: string;
    companyName: string;
    description: string;
    structured: {
      skills: Array<{ name: string; required: boolean; level?: string }>;
      seniority: string;
      workMode: string;
    };
  },
  score: number
): string {
  return buildSystemPrompt(`You are simulating a light-weight AI recruiter pre-chat summary.

This is not a transcript. It is a concise synthesized summary based on the candidate profile and job context.

Output in Markdown with exactly these sections:
### Key Findings
### Compatibility Assessment
### Recommended Next Steps
### Candidate Sentiment

Candidate:
- Name: ${talentProfile.displayName}
- Headline: ${talentProfile.headline}
- Skills: ${talentProfile.skills.map((skill) => `${skill.name} (${skill.level})`).join(', ')}
- Experience: ${talentProfile.experience.map((item) => `${item.role} at ${item.company}`).join(', ')}
- Goals: ${talentProfile.goals?.targetRoles?.join(', ') || 'Not specified'}
- Availability: ${talentProfile.availability}
- Salary range: ${
  talentProfile.salaryRange
    ? `${talentProfile.salaryRange.min ?? '?'}-${talentProfile.salaryRange.max ?? '?'} ${talentProfile.salaryRange.currency ?? ''}`.trim()
    : 'Not specified'
}

Job:
- Title: ${job.title}
- Company: ${job.companyName}
- Description: ${job.description}
- Required skills: ${job.structured.skills.filter((skill) => skill.required).map((skill) => skill.name).join(', ') || 'None listed'}
- Seniority: ${job.structured.seniority}
- Work mode: ${job.structured.workMode}

Match score: ${score}/100

Use the same language as the candidate profile.`);
}
