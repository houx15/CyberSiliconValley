import { buildSystemPrompt } from './_base';

export function buildTailoredResumePrompt(
  talentProfile: {
    displayName: string;
    headline: string;
    bio: string;
    skills: Array<{ name: string; level: string; category: string }>;
    experience: Array<{
      role: string;
      company: string;
      duration?: string;
      dateRange?: string;
      description: string;
    }>;
    education: Array<{
      degree: string;
      institution: string;
      year: string;
    }>;
  },
  job: {
    title: string;
    companyName: string;
    description: string;
    structured: {
      skills: Array<{ name: string; required: boolean; level?: string }>;
      seniority: string;
    };
  }
): string {
  return buildSystemPrompt(`You are a professional resume writer.

Rewrite this profile as a tailored resume for the target role.

Requirements:
- Output the full resume in Markdown
- Start with a Summary section
- Rewrite the headline to fit the target role
- Reorder skills and experience so the strongest job-relevant evidence appears first
- Preserve factual accuracy: reframe, do not invent
- Use the same language as the candidate profile

Candidate:
- Name: ${talentProfile.displayName}
- Current headline: ${talentProfile.headline}
- Bio: ${talentProfile.bio}
- Skills: ${talentProfile.skills.map((skill) => `${skill.name} (${skill.level})`).join(', ')}
- Experience:
${talentProfile.experience
  .map(
    (item) =>
      `  - ${item.role} at ${item.company} (${item.dateRange || item.duration || 'Date not specified'}): ${item.description}`
  )
  .join('\n')}
- Education:
${talentProfile.education
  .map((item) => `  - ${item.degree}, ${item.institution} (${item.year})`)
  .join('\n')}

Target job:
- Title: ${job.title}
- Company: ${job.companyName}
- Description: ${job.description}
- Required skills: ${job.structured.skills.filter((skill) => skill.required).map((skill) => skill.name).join(', ') || 'None listed'}
- Nice-to-have skills: ${job.structured.skills.filter((skill) => !skill.required).map((skill) => skill.name).join(', ') || 'None listed'}
- Seniority: ${job.structured.seniority}`);
}
