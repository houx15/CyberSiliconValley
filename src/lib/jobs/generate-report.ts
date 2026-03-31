import type { Job } from 'bullmq';
import { generateText } from 'ai';
import { and, desc, eq } from 'drizzle-orm';
import { getModel } from '@/lib/ai/providers';
import { buildAssessmentPrompt } from '@/lib/ai/prompts/seeking-assessment';
import type { SeekingReportData } from '@/lib/api/seeking';
import { upsertReport } from '@/lib/api/seeking';
import type { StructuredJob, Skill } from '@/types';

export async function handleGenerateReport(
  job: Job<{ talentId: string }>
): Promise<void> {
  const [{ db }, schema] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/db/schema'),
  ]);

  const { talentId } = job.data;
  const [profile] = await db
    .select()
    .from(schema.talentProfiles)
    .where(eq(schema.talentProfiles.id, talentId))
    .limit(1);

  if (!profile) {
    job.log(`Talent profile ${talentId} not found`);
    return;
  }

  const matchRows = await db
    .select({
      matchId: schema.matches.id,
      jobId: schema.jobs.id,
      score: schema.matches.score,
      aiReasoning: schema.matches.aiReasoning,
      status: schema.matches.status,
      jobTitle: schema.jobs.title,
      jobDescription: schema.jobs.description,
      jobStructured: schema.jobs.structured,
      companyName: schema.enterpriseProfiles.companyName,
    })
    .from(schema.matches)
    .innerJoin(schema.jobs, eq(schema.matches.jobId, schema.jobs.id))
    .leftJoin(
      schema.enterpriseProfiles,
      eq(schema.jobs.enterpriseId, schema.enterpriseProfiles.id)
    )
    .where(eq(schema.matches.talentId, talentId))
    .orderBy(desc(schema.matches.score));

  const skills = (profile.skills as Skill[]) ?? [];
  const skillNames = new Set(skills.map((skill) => skill.name.toLowerCase()));
  const highMatches = matchRows.filter((row) => row.score >= 80);
  const mediumMatches = matchRows.filter(
    (row) => row.score >= 60 && row.score < 80
  );

  const highMatchItems = await Promise.all(
    highMatches.slice(0, 6).map(async (row) => {
      const structured = (row.jobStructured as StructuredJob) ?? {
        skills: [],
        seniority: '',
        timeline: '',
        deliverables: [],
        budget: { currency: 'CNY' },
        workMode: 'remote',
      };

      let aiAssessment = row.aiReasoning ?? '';
      if (!aiAssessment) {
        try {
          const { text } = await generateText({
            model: getModel(),
            prompt: buildAssessmentPrompt(
              {
                displayName: profile.displayName ?? '',
                headline: profile.headline ?? '',
                skills,
                experience:
                  ((profile.experience as Array<{
                    role: string;
                    company: string;
                    description: string;
                  }>) ?? []),
                goals: (profile.goals as { targetRoles?: string[] }) ?? {},
              },
              {
                title: row.jobTitle,
                companyName: row.companyName ?? 'Unknown company',
                description: row.jobDescription ?? '',
                structured: {
                  skills: structured.skills ?? [],
                  seniority: structured.seniority ?? '',
                  workMode: structured.workMode ?? 'remote',
                },
              },
              row.score
            ),
            maxOutputTokens: 220,
          });
          aiAssessment = text;
        } catch {
          aiAssessment = `${row.companyName ?? '这家公司'} 对你在 ${structured.skills
            ?.filter((skill) => skill.required)
            .map((skill) => skill.name)
            .slice(0, 2)
            .join('、') || '核心能力'} 上的经验很感兴趣。建议在沟通中强调你过往项目里的业务结果和复杂场景处理能力。`;
        }
      }

      return {
        matchId: row.matchId,
        jobId: row.jobId,
        jobTitle: row.jobTitle,
        companyName: row.companyName ?? 'Unknown company',
        location: 'Remote',
        workMode: structured.workMode ?? 'remote',
        score: row.score,
        skillMatches: (structured.skills ?? []).map((skill) => ({
          skill: skill.name,
          matched: skillNames.has(skill.name.toLowerCase()),
          level: skill.required ? 'must-have' : 'nice-to-have',
        })),
        aiAssessment,
      };
    })
  );

  const preChatRows = await db
    .select({
      id: schema.inboxItems.id,
      title: schema.inboxItems.title,
      content: schema.inboxItems.content,
      createdAt: schema.inboxItems.createdAt,
    })
    .from(schema.inboxItems)
    .where(
      and(
        eq(schema.inboxItems.userId, profile.userId),
        eq(schema.inboxItems.itemType, 'prechat_summary')
      )
    )
    .orderBy(desc(schema.inboxItems.createdAt))
    .limit(5);

  const preChatActivity = preChatRows.map((row) => {
    const content = (row.content as Record<string, unknown>) ?? {};
    return {
      inboxItemId: row.id,
      companyName: (content.companyName as string) ?? 'Unknown company',
      jobTitle: (content.jobTitle as string) ?? row.title ?? 'Unknown role',
      summary: (content.summary as string) ?? '',
      generatedAt: row.createdAt.toISOString(),
    };
  });

  const inboundRows = matchRows.filter(
    (row) => row.status === 'shortlisted' || row.status === 'invited'
  );

  const inboundInterest = inboundRows.slice(0, 6).map((row) => ({
    matchId: row.matchId,
    companyName: row.companyName ?? 'Unknown company',
    reason:
      row.aiReasoning ??
      'Your profile is already resonating with this hiring team.',
    score: row.score,
    jobId: row.jobId,
  }));

  const reportData: SeekingReportData = {
    scanSummary: {
      totalScanned: matchRows.length,
      highMatches: highMatches.length,
      mediumMatches: mediumMatches.length,
      periodLabel: 'This week',
    },
    highMatches: highMatchItems,
    preChatActivity,
    inboundInterest,
    generatedAt: new Date().toISOString(),
  };

  await upsertReport(talentId, reportData);
}
