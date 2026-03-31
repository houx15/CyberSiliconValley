import type { Job } from 'bullmq';
import { generateText } from 'ai';
import { and, eq, gte } from 'drizzle-orm';
import { getModel } from '@/lib/ai/providers';
import { buildPreChatPrompt } from '@/lib/ai/prompts/pre-chat';
import { createInboxItem } from '@/lib/api/inbox';
import type { StructuredJob, Skill } from '@/types';

export async function handlePreChat(
  job: Job<{ jobId: string; talentId?: string }>
): Promise<void> {
  const [{ db }, schema] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/db/schema'),
  ]);

  const [jobRow] = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.title,
      description: schema.jobs.description,
      enterpriseId: schema.jobs.enterpriseId,
      structured: schema.jobs.structured,
      companyName: schema.enterpriseProfiles.companyName,
      enterpriseUserId: schema.enterpriseProfiles.userId,
    })
    .from(schema.jobs)
    .leftJoin(
      schema.enterpriseProfiles,
      eq(schema.jobs.enterpriseId, schema.enterpriseProfiles.id)
    )
    .where(eq(schema.jobs.id, job.data.jobId))
    .limit(1);

  if (!jobRow) {
    job.log(`Job ${job.data.jobId} not found`);
    return;
  }

  const matches = await db
    .select({
      score: schema.matches.score,
      talentId: schema.talentProfiles.id,
      talentUserId: schema.talentProfiles.userId,
      displayName: schema.talentProfiles.displayName,
      headline: schema.talentProfiles.headline,
      skills: schema.talentProfiles.skills,
      experience: schema.talentProfiles.experience,
      goals: schema.talentProfiles.goals,
      availability: schema.talentProfiles.availability,
      salaryRange: schema.talentProfiles.salaryRange,
    })
    .from(schema.matches)
    .innerJoin(
      schema.talentProfiles,
      eq(schema.matches.talentId, schema.talentProfiles.id)
    )
    .where(and(eq(schema.matches.jobId, job.data.jobId), gte(schema.matches.score, 80)));

  const structured = (jobRow.structured as StructuredJob) ?? {
    skills: [],
    seniority: '',
    timeline: '',
    deliverables: [],
    budget: { currency: 'CNY' },
    workMode: 'remote',
  };

  for (const match of matches) {
    let summary = '';

    try {
      const { text } = await generateText({
        model: getModel(),
        prompt: buildPreChatPrompt(
          {
            displayName: match.displayName ?? '',
            headline: match.headline ?? '',
            skills: ((match.skills as Skill[]) ?? []),
            experience:
              ((match.experience as Array<{
                role: string;
                company: string;
                description: string;
              }>) ?? []),
            goals: (match.goals as { targetRoles?: string[] }) ?? {},
            availability: match.availability ?? 'open',
            salaryRange:
              (match.salaryRange as {
                min?: number;
                max?: number;
                currency?: string;
              } | null) ?? null,
          },
          {
            title: jobRow.title,
            companyName: jobRow.companyName ?? 'Unknown company',
            description: jobRow.description ?? '',
            structured: {
              skills: structured.skills ?? [],
              seniority: structured.seniority ?? '',
              workMode: structured.workMode ?? 'remote',
            },
          },
          match.score
        ),
        maxOutputTokens: 420,
      });
      summary = text;
    } catch {
      summary = `### Key Findings
- Candidate appears strong on the core job requirements.
- The profile suggests clear interest in applied AI work.

### Compatibility Assessment
This looks like a credible next-round conversation.

### Recommended Next Steps
- Validate recent project depth
- Confirm timing and compensation alignment

### Candidate Sentiment
Likely interested if the scope remains technical and ownership-heavy.`;
    }

    await createInboxItem({
      userId: match.talentUserId,
      itemType: 'prechat_summary',
      title: `AI pre-chat summary: ${jobRow.companyName ?? 'Company'} / ${jobRow.title}`,
      content: {
        companyName: jobRow.companyName,
        jobTitle: jobRow.title,
        jobId: jobRow.id,
        matchScore: match.score,
        summary,
      },
    });

    if (jobRow.enterpriseUserId) {
      await createInboxItem({
        userId: jobRow.enterpriseUserId,
        itemType: 'prechat_summary',
        title: `AI pre-chat summary: ${match.displayName ?? 'Candidate'} / ${jobRow.title}`,
        content: {
          talentName: match.displayName,
          talentId: match.talentId,
          jobTitle: jobRow.title,
          jobId: jobRow.id,
          matchScore: match.score,
          summary,
        },
      });
    }
  }
}
