import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText } from 'ai';
import { eq } from 'drizzle-orm';
import { verifyJWT } from '@/lib/auth';
import { getModel } from '@/lib/ai/providers';
import { buildTailoredResumePrompt } from '@/lib/ai/prompts/tailored-resume';

const requestSchema = z.object({
  talentId: z.string().min(1),
  jobId: z.string().min(1),
});

function buildFallbackResume(input: {
  talentName: string;
  headline: string;
  bio: string;
  companyName: string;
  jobTitle: string;
  skills: Array<{ name: string; level: string }>;
  experience: Array<{ role: string; company: string; description: string; duration?: string }>;
}) {
  return `# ${input.talentName}

## Summary
${input.headline} with hands-on experience relevant to ${input.jobTitle} at ${input.companyName}. ${input.bio}

## Core Skills
${input.skills.map((skill) => `- ${skill.name} (${skill.level})`).join('\n')}

## Experience
${input.experience
  .map(
    (item) =>
      `### ${item.role} · ${item.company}\n${item.duration ?? ''}\n- ${item.description}`
  )
  .join('\n\n')}`.trim();
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await verifyJWT(token);
    const body = requestSchema.parse(await request.json());

    const [{ db }, schema] = await Promise.all([
      import('@/lib/db'),
      import('@/lib/db/schema'),
    ]);

    const [profile] = await db
      .select()
      .from(schema.talentProfiles)
      .where(eq(schema.talentProfiles.id, body.talentId))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ error: 'Talent profile not found' }, { status: 404 });
    }

    if (auth.role === 'talent' && profile.userId !== auth.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [jobRow] = await db
      .select({
        id: schema.jobs.id,
        title: schema.jobs.title,
        description: schema.jobs.description,
        structured: schema.jobs.structured,
        companyName: schema.enterpriseProfiles.companyName,
      })
      .from(schema.jobs)
      .leftJoin(
        schema.enterpriseProfiles,
        eq(schema.jobs.enterpriseId, schema.enterpriseProfiles.id)
      )
      .where(eq(schema.jobs.id, body.jobId))
      .limit(1);

    if (!jobRow) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const profileSkills =
      ((profile.skills as Array<{ name: string; level: string; category: string }>) ?? []);
    const profileExperience =
      ((profile.experience as Array<{
        role: string;
        company: string;
        description: string;
        duration?: string;
        dateRange?: string;
      }>) ?? []);
    const profileEducation =
      ((profile.education as Array<{
        degree: string;
        institution: string;
        year: string;
      }>) ?? []);

    let markdown = '';
    try {
      const { text } = await generateText({
        model: getModel(),
        prompt: buildTailoredResumePrompt(
          {
            displayName: profile.displayName ?? '',
            headline: profile.headline ?? '',
            bio: profile.bio ?? '',
            skills: profileSkills,
            experience: profileExperience,
            education: profileEducation,
          },
          {
            title: jobRow.title,
            companyName: jobRow.companyName ?? 'Unknown company',
            description: jobRow.description ?? '',
            structured: {
              skills:
                ((jobRow.structured as { skills?: Array<{ name: string; required: boolean; level?: string }> })?.skills ??
                  []),
              seniority:
                ((jobRow.structured as { seniority?: string })?.seniority ?? ''),
            },
          }
        ),
        maxOutputTokens: 900,
      });
      markdown = text;
    } catch {
      markdown = buildFallbackResume({
        talentName: profile.displayName ?? '',
        headline: profile.headline ?? '',
        bio: profile.bio ?? '',
        companyName: jobRow.companyName ?? 'Unknown company',
        jobTitle: jobRow.title,
        skills: profileSkills,
        experience: profileExperience,
      });
    }

    return NextResponse.json({
      data: {
        markdown,
        talentName: profile.displayName ?? '',
        jobTitle: jobRow.title,
        companyName: jobRow.companyName ?? 'Unknown company',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: error.flatten() },
        { status: 400 }
      );
    }

    console.error('POST /api/v1/resume/generate error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to generate tailored resume' },
      { status: 500 }
    );
  }
}
