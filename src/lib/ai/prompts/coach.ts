import { buildSystemPrompt } from './_base';
import type { CoachMode } from '@/types/graph';

export type CoachPromptContext = {
  profileJson: string;
  goals: string;
  recentMatchesSummary: string;
};

type CoachModeInstructionMap = Record<CoachMode, string>;

const MODE_INSTRUCTIONS: CoachModeInstructionMap = {
  chat: `You are in general coaching mode.
Focus on the user's current goals, profile, and live market opportunities.
Keep the advice specific, concise, and actionable.`,
  'resume-review': `You are reviewing the user's positioning and resume.
Look for ways to sharpen the summary, reword experience bullets, and make impact easier to see.
When suggesting edits, use a clear BEFORE / AFTER format and explain why the revision is stronger.
Use the updateProfileField tool when the user approves a concrete change.`,
  'mock-interview': `You are conducting a realistic mock interview.
Start with a warm introduction, then move through technical questions, behavioral questions, and "why this role" questions.
After each answer, provide direct feedback, a stronger sample answer when useful, and one clear next improvement.`,
  'skill-gaps': `You are analyzing skill gaps against the user's target roles and recent opportunities.
Present the gaps in priority order, with the highest-impact gaps first.
For each gap, explain why it matters, what level is currently needed, and how the user can close it with practical learning resources.
Use the suggestSkill tool for concrete skill recommendations.`,
};

function buildCoachBaseContext(context: CoachPromptContext): string {
  const base = `You are the CSV career coach.

User profile:
${context.profileJson}

User goals:
${context.goals}

Recent match landscape:
${context.recentMatchesSummary}

Coach directives:
- Be warm, specific, and honest.
- Tie advice back to the user's actual profile and real opportunities in the market.
- Keep responses concise unless the user explicitly asks for depth.
- Prefer concrete next steps over generic encouragement.`;

  return `${base}

Tool guidance:
- Use updateProfileField when the user approves a concrete profile improvement.
- Use suggestSkill when you identify a skill gap that should be recommended explicitly.`;
}

export function buildCoachSystemPrompt(
  mode: CoachMode,
  context: CoachPromptContext
): string {
  return buildSystemPrompt(
    [buildCoachBaseContext(context), MODE_INSTRUCTIONS[mode]].join('\n\n')
  );
}

export const COACH_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'updateProfileField',
      description:
        'Update a talent profile field after the user approves a suggested improvement.',
      parameters: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            description:
              'Profile field to update. One of: headline, bio, skills, experience, education, goals, availability',
          },
          value: {
            type: ['string', 'number', 'boolean', 'object', 'array', 'null'],
            description:
              'Replacement value for the field. Use a string for text fields and structured values for skills, experience, education, or goals.',
          },
        },
        required: ['field', 'value'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggestSkill',
      description:
        'Suggest a skill the user should develop, with the reason and expected impact on their career.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Skill name to recommend',
          },
          reason: {
            type: 'string',
            description:
              'Why the skill matters and how the user can start building it',
          },
        },
        required: ['name', 'reason'],
        additionalProperties: false,
      },
    },
  },
] as const;
