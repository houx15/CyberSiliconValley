import { buildSystemPrompt } from './_base';

export function buildAssessmentPrompt(
  talentProfile: {
    displayName: string;
    headline: string;
    skills: Array<{ name: string; level: string; category: string }>;
    experience: Array<{ role: string; company: string; description: string }>;
    goals?: { targetRoles?: string[]; workPreferences?: string[] };
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
  return buildSystemPrompt(`You are evaluating a talent-job match for the CSV seeking report.

Write a concise 2-3 sentence assessment that covers:
1. Why this fit is strong or moderate with specific overlapping skills or experience
2. The most important gap or execution risk
3. One concrete suggestion for how the candidate should position themselves

Do not be generic. Mention real skills, job requirements, and company context.
Respond in the same language as the talent profile.

Talent:
- Name: ${talentProfile.displayName}
- Headline: ${talentProfile.headline}
- Skills: ${talentProfile.skills.map((skill) => `${skill.name} (${skill.level})`).join(', ')}
- Experience: ${talentProfile.experience.map((item) => `${item.role} at ${item.company}: ${item.description}`).join('\n')}
- Goals: ${talentProfile.goals?.targetRoles?.join(', ') || 'Not specified'}

Job:
- Title: ${job.title}
- Company: ${job.companyName}
- Description: ${job.description}
- Required skills: ${job.structured.skills.filter((skill) => skill.required).map((skill) => skill.name).join(', ') || 'None listed'}
- Nice-to-have skills: ${job.structured.skills.filter((skill) => !skill.required).map((skill) => skill.name).join(', ') || 'None listed'}
- Seniority: ${job.structured.seniority}
- Work mode: ${job.structured.workMode}

Match score: ${score}/100`);
}
