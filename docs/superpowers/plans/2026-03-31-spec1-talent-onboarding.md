# Spec 1: Talent Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the talent onboarding experience — a full-screen, cinematic AI conversation that discovers the user's identity, skills, experience, and goals, progressively revealing a fog-clearing profile panel in real time.

**Architecture:** Full-screen route (`/talent/onboarding`) outside the `(talent)` layout shell, with a split-screen UI: left panel for streaming AI chat, right panel for a fog-clearing profile reveal. A single `POST /api/internal/ai/onboarding` endpoint handles all conversation logic via a 6-phase system prompt. Tool calls (`revealProfileField`, `addSkillTag`, `completeOnboarding`) drive both client-side animations and server-side profile persistence. State is tracked in `chat_sessions.context` JSONB.

**Tech Stack:** Next.js 15 App Router, TypeScript, Vercel AI SDK (streamText + tool definitions), Drizzle ORM, Framer Motion, Tailwind CSS 4, shadcn/ui, Web Speech API, Zod

---

## File Structure

```
csv/
├── src/
│   ├── app/
│   │   └── talent/
│   │       └── onboarding/
│   │           ├── page.tsx                          # Full-screen onboarding page (server component, redirect logic)
│   │           └── onboarding-client.tsx              # Client component: split-screen chat + profile
│   │   └── api/
│   │       └── internal/
│   │           └── ai/
│   │               └── onboarding/
│   │                   └── route.ts                   # POST streaming AI endpoint
│   ├── components/
│   │   └── onboarding/
│   │       ├── chat-panel.tsx                         # Left panel: chat messages + input + entry paths
│   │       ├── profile-panel.tsx                      # Right panel: fog-clearing profile sections
│   │       ├── fog-section.tsx                        # Reusable fog-clearing wrapper (Framer Motion)
│   │       ├── skill-tag.tsx                          # Animated skill tag component
│   │       ├── entry-path-selector.tsx                # Resume upload / URL / conversation / voice buttons
│   │       ├── voice-input.tsx                        # Web Speech API voice recording button
│   │       ├── guided-tour.tsx                        # Post-onboarding tour overlay
│   │       └── ai-avatar.tsx                          # Animated AI avatar (gradient circle)
│   ├── lib/
│   │   └── ai/
│   │       └── prompts/
│   │           └── onboarding.ts                      # Onboarding system prompt + tool definitions
│   └── i18n/
│       └── messages/
│           ├── en.json                                # Add onboarding strings
│           └── zh.json                                # Add onboarding strings
└── __tests__/
    └── onboarding/
        └── onboarding-api.test.ts                     # API endpoint tests
```

---

### Task 1: Onboarding System Prompt + Tool Definitions

**Files:**
- Create: `src/lib/ai/prompts/onboarding.ts`

- [ ] **Step 1: Create onboarding prompt module**

Create `src/lib/ai/prompts/onboarding.ts`:

```typescript
import { z } from 'zod';
import { tool } from 'ai';
import { buildSystemPrompt } from './_base';

export interface OnboardingContext {
  displayName?: string;
  headline?: string;
  bio?: string;
  skills: Array<{ name: string; level: string; category: string }>;
  experience: Array<{ company: string; role: string; duration: string; description: string }>;
  education: Array<{ school: string; degree: string; field: string; year: string }>;
  goals: {
    targetRoles?: string[];
    workPreferences?: string[];
    motivation?: string;
  };
  availability?: string;
  salaryRange?: { min?: number; max?: number; currency?: string };
  currentPhase: 'greeting' | 'identity' | 'skills' | 'experience' | 'goals' | 'completion';
  entryMethod?: 'resume' | 'url' | 'conversation' | 'voice';
  resumeText?: string;
  urlContent?: string;
}

export const INITIAL_ONBOARDING_CONTEXT: OnboardingContext = {
  skills: [],
  experience: [],
  education: [],
  goals: {},
  currentPhase: 'greeting',
};

export function buildOnboardingSystemPrompt(context: OnboardingContext): string {
  const collectedFields: string[] = [];
  const missingFields: string[] = [];

  if (context.displayName) collectedFields.push(`Name: ${context.displayName}`);
  else missingFields.push('Name');

  if (context.headline) collectedFields.push(`Headline/Title: ${context.headline}`);
  else missingFields.push('Headline/Title');

  if (context.bio) collectedFields.push(`Bio: ${context.bio}`);
  else missingFields.push('Bio (short professional summary)');

  if (context.skills.length > 0) collectedFields.push(`Skills: ${context.skills.map(s => `${s.name} (${s.level})`).join(', ')}`);
  else missingFields.push('Skills (with proficiency levels)');

  if (context.experience.length > 0) collectedFields.push(`Experience: ${context.experience.length} entries`);
  else missingFields.push('Work experience');

  if (context.goals.targetRoles?.length) collectedFields.push(`Target roles: ${context.goals.targetRoles.join(', ')}`);
  else missingFields.push('Career goals / target roles');

  if (context.availability) collectedFields.push(`Availability: ${context.availability}`);
  else missingFields.push('Availability');

  const featurePrompt = `You are guiding a new talent user through their onboarding on CSV (Cyber Silicon Valley), an AI talent-matching platform.

## Your Mission
Discover who this person is professionally through natural conversation. You will extract structured profile data and reveal it on their profile panel using tool calls. Each tool call triggers a beautiful fog-clearing animation on their screen.

## Conversation Phases (follow this order, but keep the conversation flowing naturally)

### Phase 1: Greeting
- Welcome them warmly. You are their AI companion — introduce yourself briefly.
- Ask how they'd like to get started: upload a resume, share a link, just chat, or send a voice message.
- Keep it to 2-3 sentences max. Be excited but not overwhelming.

### Phase 2: Identity
- Learn their name and what they do (current role/title).
- Once you know their name, immediately call revealProfileField("displayName", name).
- Once you know their role/title, call revealProfileField("headline", headline).
- If they shared a resume or URL, you may already have this — extract and confirm.

### Phase 3: Skills
- Discover their technical skills, tools, and frameworks.
- For each skill confirmed, call addSkillTag(name, level, category).
- Ask clarifying questions to determine proficiency: "How long have you been using X?" "Have you built production systems with it?"
- Map proficiency: <1 year or learning = beginner, 1-2 years = intermediate, 2-5 years = advanced, 5+ years or deep expertise = expert.
- Group skills into categories: "AI/ML", "Programming Languages", "Frameworks", "Data", "DevOps", "Design", "Management", etc.

### Phase 4: Experience
- Learn about their work history — companies, roles, durations, key achievements.
- For each experience entry, call revealProfileField("experience", full_experience_array) with the updated array.
- Ask for specifics: "What was your biggest impact at X?" "What did you build?"

### Phase 5: Goals
- Understand what they're looking for: target roles, work preferences (remote/onsite/hybrid), salary expectations.
- Call revealProfileField("goals", goals_object) when you have enough.
- Call revealProfileField("availability", availability) when discussed.
- Call revealProfileField("bio", bio) — synthesize a 2-3 sentence professional summary from everything you've learned.

### Phase 6: Completion
- Summarize what you've captured. Let them know their profile is ready.
- Call completeOnboarding() to finalize.
- Tell them you'll show them around the platform next.

## Rules
- ALWAYS use tool calls to reveal information. Never just describe what you found without calling the tool.
- If the user uploaded a resume or shared a URL and the content is available, extract as much as possible and confirm with the user before revealing each section.
- Keep your messages concise — max 3-4 sentences per turn during conversation phases.
- If the user provides a lot of information at once, process it systematically: confirm, then make multiple tool calls in sequence.
- Be specific and personal, not generic. Reference details the user mentioned.
- Remember: this is their first impression of the platform. Make it feel magical.

## Collected So Far
${collectedFields.length > 0 ? collectedFields.join('\n') : 'Nothing yet — this is the start.'}

## Still Needed
${missingFields.length > 0 ? missingFields.join('\n') : 'All key information collected! Move to completion.'}

## Current Phase: ${context.currentPhase}
${context.resumeText ? `\n## Resume Content (uploaded by user):\n${context.resumeText}` : ''}
${context.urlContent ? `\n## URL Content (provided by user):\n${context.urlContent}` : ''}`;

  return buildSystemPrompt(featurePrompt, context as unknown as Record<string, unknown>);
}

export const onboardingTools = {
  revealProfileField: tool({
    description: 'Reveal a profile field on the user\'s profile panel with a fog-clearing animation. Call this whenever you have confirmed a piece of profile information.',
    parameters: z.object({
      field: z.enum([
        'displayName',
        'headline',
        'bio',
        'experience',
        'education',
        'goals',
        'availability',
        'salaryRange',
      ]),
      value: z.any().describe('The value for this field. For displayName/headline/bio/availability: string. For experience: array of {company, role, duration, description}. For education: array of {school, degree, field, year}. For goals: {targetRoles: string[], workPreferences: string[], motivation: string}. For salaryRange: {min: number, max: number, currency: string}.'),
    }),
  }),
  addSkillTag: tool({
    description: 'Add a skill tag to the user\'s profile with an entrance animation. Call this for each individual skill discovered.',
    parameters: z.object({
      name: z.string().describe('The skill name, e.g. "Python", "RAG Pipeline", "LangChain"'),
      level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).describe('Proficiency level based on years of experience and depth'),
      category: z.string().describe('Skill category, e.g. "AI/ML", "Programming Languages", "Frameworks", "Data", "DevOps"'),
    }),
  }),
  completeOnboarding: tool({
    description: 'Mark the onboarding as complete. Call this after summarizing the profile and confirming with the user.',
    parameters: z.object({}),
  }),
};
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(onboarding): add system prompt and tool definitions for talent onboarding"
```

---

### Task 2: Onboarding API Endpoint

**Files:**
- Create: `src/app/api/internal/ai/onboarding/route.ts`

- [ ] **Step 1: Write API endpoint test**

Create `src/__tests__/onboarding/onboarding-api.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { INITIAL_ONBOARDING_CONTEXT, buildOnboardingSystemPrompt } from '@/lib/ai/prompts/onboarding';

describe('onboarding prompt', () => {
  it('builds initial system prompt with all fields missing', () => {
    const prompt = buildOnboardingSystemPrompt(INITIAL_ONBOARDING_CONTEXT);
    expect(prompt).toContain('Phase 1: Greeting');
    expect(prompt).toContain('Nothing yet');
    expect(prompt).toContain('Name');
    expect(prompt).toContain('Current Phase: greeting');
  });

  it('includes collected fields in prompt', () => {
    const context = {
      ...INITIAL_ONBOARDING_CONTEXT,
      displayName: 'Zhang Wei',
      headline: 'Senior AI Engineer',
      skills: [{ name: 'Python', level: 'expert', category: 'Programming Languages' }],
      currentPhase: 'skills' as const,
    };
    const prompt = buildOnboardingSystemPrompt(context);
    expect(prompt).toContain('Name: Zhang Wei');
    expect(prompt).toContain('Headline/Title: Senior AI Engineer');
    expect(prompt).toContain('Python (expert)');
    expect(prompt).toContain('Current Phase: skills');
    expect(prompt).not.toContain('Nothing yet');
  });

  it('shows all collected when complete', () => {
    const context = {
      ...INITIAL_ONBOARDING_CONTEXT,
      displayName: 'Li Mei',
      headline: 'ML Engineer',
      bio: 'Experienced ML engineer specializing in NLP.',
      skills: [{ name: 'PyTorch', level: 'advanced', category: 'AI/ML' }],
      experience: [{ company: 'Acme', role: 'Engineer', duration: '2 years', description: 'Built NLP pipelines' }],
      goals: { targetRoles: ['Senior ML Engineer'], workPreferences: ['remote'] },
      availability: 'open',
      currentPhase: 'completion' as const,
    };
    const prompt = buildOnboardingSystemPrompt(context);
    expect(prompt).toContain('All key information collected');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npx vitest run src/__tests__/onboarding/onboarding-api.test.ts
```

Expected: PASS.

- [ ] **Step 3: Create API endpoint**

Create `src/app/api/internal/ai/onboarding/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai/providers';
import { getOrCreateSession, loadChatHistory, saveChatMessage, updateSessionContext, getSessionContext } from '@/lib/ai/chat';
import { buildOnboardingSystemPrompt, onboardingTools, INITIAL_ONBOARDING_CONTEXT } from '@/lib/ai/prompts/onboarding';
import type { OnboardingContext } from '@/lib/ai/prompts/onboarding';
import { db } from '@/lib/db';
import { talentProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthFromRequest } from '@/lib/auth/middleware';

const requestSchema = z.object({
  message: z.string().min(1),
  entryMethod: z.enum(['resume', 'url', 'conversation', 'voice']).optional(),
  resumeText: z.string().optional(),
  urlContent: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await getAuthFromRequest(req);
  if (!auth || auth.role !== 'talent') {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'VALIDATION_ERROR', details: parsed.error.errors }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { message, entryMethod, resumeText, urlContent } = parsed.data;

  // Get or create onboarding session
  const session = await getOrCreateSession(auth.userId, 'onboarding');
  let context = (await getSessionContext(session.id)) as unknown as OnboardingContext;

  // Initialize context if empty
  if (!context || !context.currentPhase) {
    context = { ...INITIAL_ONBOARDING_CONTEXT };
  }

  // Update context with entry method info
  if (entryMethod) context.entryMethod = entryMethod;
  if (resumeText) context.resumeText = resumeText;
  if (urlContent) context.urlContent = urlContent;

  // Save user message
  await saveChatMessage(session.id, 'user', message);

  // Load history
  const history = await loadChatHistory(session.id);

  // Build system prompt with current context
  const systemPrompt = buildOnboardingSystemPrompt(context);

  // Stream response with tool calls
  const result = streamText({
    model: getModel(),
    system: systemPrompt,
    messages: history,
    tools: onboardingTools,
    maxSteps: 10,
    onFinish: async ({ text, toolCalls }) => {
      // Save assistant message
      if (text) {
        await saveChatMessage(session.id, 'assistant', text, { toolCalls });
      }

      // Process tool calls to update context and DB
      if (toolCalls) {
        for (const toolCall of toolCalls) {
          if (toolCall.toolName === 'revealProfileField') {
            const { field, value } = toolCall.args as { field: string; value: unknown };
            (context as Record<string, unknown>)[field] = value;

            // Advance phase based on what's collected
            context.currentPhase = determinePhase(context);

            // Persist to talent_profiles
            await updateTalentProfile(auth.userId, field, value);
          }

          if (toolCall.toolName === 'addSkillTag') {
            const { name, level, category } = toolCall.args as { name: string; level: string; category: string };
            context.skills.push({ name, level, category });
            context.currentPhase = determinePhase(context);

            // Persist skills to talent_profiles
            await db
              .update(talentProfiles)
              .set({ skills: context.skills, updatedAt: new Date() })
              .where(eq(talentProfiles.userId, auth.userId));
          }

          if (toolCall.toolName === 'completeOnboarding') {
            context.currentPhase = 'completion';

            await db
              .update(talentProfiles)
              .set({ onboardingDone: true, updatedAt: new Date() })
              .where(eq(talentProfiles.userId, auth.userId));
          }
        }

        // Save updated context
        await updateSessionContext(session.id, context as unknown as Record<string, unknown>);
      }
    },
  });

  return result.toDataStreamResponse();
}

function determinePhase(context: OnboardingContext): OnboardingContext['currentPhase'] {
  if (!context.displayName && !context.headline) return 'identity';
  if (context.skills.length === 0) return 'skills';
  if (context.experience.length === 0) return 'experience';
  if (!context.goals.targetRoles?.length) return 'goals';
  return 'completion';
}

async function updateTalentProfile(userId: string, field: string, value: unknown) {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  switch (field) {
    case 'displayName':
      updateData.displayName = value as string;
      break;
    case 'headline':
      updateData.headline = value as string;
      break;
    case 'bio':
      updateData.bio = value as string;
      break;
    case 'experience':
      updateData.experience = value;
      break;
    case 'education':
      updateData.education = value;
      break;
    case 'goals':
      updateData.goals = value;
      break;
    case 'availability':
      updateData.availability = value as string;
      break;
    case 'salaryRange':
      updateData.salaryRange = value;
      break;
  }

  await db
    .update(talentProfiles)
    .set(updateData)
    .where(eq(talentProfiles.userId, userId));
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(onboarding): add streaming AI endpoint with tool call handling"
```

---

### Task 3: AI Avatar Component

**Files:**
- Create: `src/components/onboarding/ai-avatar.tsx`

- [ ] **Step 1: Create AI avatar component**

Create `src/components/onboarding/ai-avatar.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';

interface AIAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

export function AIAvatar({ size = 'md', animate = true }: AIAvatarProps) {
  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-20 w-20',
  };

  return (
    <motion.div
      className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25`}
      initial={animate ? { scale: 0, opacity: 0 } : false}
      animate={
        animate
          ? {
              scale: 1,
              opacity: 1,
            }
          : undefined
      }
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        delay: 0.3,
      }}
    >
      <motion.div
        className="h-full w-full rounded-full bg-gradient-to-br from-white/20 to-transparent"
        animate={
          animate
            ? {
                scale: [1, 1.05, 1],
                opacity: [0.8, 1, 0.8],
              }
            : undefined
        }
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(onboarding): add animated AI avatar component"
```

---

### Task 4: Fog Section + Skill Tag Components

**Files:**
- Create: `src/components/onboarding/fog-section.tsx`
- Create: `src/components/onboarding/skill-tag.tsx`

- [ ] **Step 1: Create fog-clearing section wrapper**

Create `src/components/onboarding/fog-section.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface FogSectionProps {
  revealed: boolean;
  children: ReactNode;
  label: string;
  delay?: number;
}

export function FogSection({ revealed, children, label, delay = 0 }: FogSectionProps) {
  return (
    <div className="relative mb-4">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
      <motion.div
        initial={{ filter: 'blur(20px)', opacity: 0, scale: 0.95 }}
        animate={
          revealed
            ? { filter: 'blur(0px)', opacity: 1, scale: 1 }
            : { filter: 'blur(20px)', opacity: 0, scale: 0.95 }
        }
        transition={{
          type: 'spring',
          stiffness: 100,
          damping: 20,
          duration: 0.6,
          delay,
        }}
      >
        {children}
      </motion.div>
      {!revealed && (
        <div className="absolute inset-0 mt-6 flex items-center justify-center">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted/30" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create skill tag component**

Create `src/components/onboarding/skill-tag.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';

interface SkillTagProps {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  category: string;
  index: number;
}

const levelStyles = {
  expert: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  advanced: 'bg-blue-500/16 text-blue-300 border-blue-500/30 opacity-90',
  intermediate: 'bg-cyan-500/12 text-cyan-300 border-cyan-500/25 opacity-80',
  beginner: 'bg-slate-500/10 text-slate-300 border-slate-500/20 opacity-70',
};

const levelLabels = {
  expert: 'Expert',
  advanced: 'Advanced',
  intermediate: 'Intermediate',
  beginner: 'Beginner',
};

export function SkillTag({ name, level, category, index }: SkillTagProps) {
  return (
    <motion.span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${levelStyles[level]}`}
      initial={{ filter: 'blur(10px)', opacity: 0, scale: 0.8 }}
      animate={{ filter: 'blur(0px)', opacity: 1, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 15,
        delay: index * 0.1,
      }}
      title={`${name} — ${levelLabels[level]} (${category})`}
    >
      {name}
      <span className="text-[10px] opacity-60">{levelLabels[level][0]}</span>
    </motion.span>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(onboarding): add fog-clearing section and skill tag components"
```

---

### Task 5: Entry Path Selector + Voice Input

**Files:**
- Create: `src/components/onboarding/entry-path-selector.tsx`
- Create: `src/components/onboarding/voice-input.tsx`

- [ ] **Step 1: Create entry path selector**

Create `src/components/onboarding/entry-path-selector.tsx`:

```typescript
'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface EntryPathSelectorProps {
  onResumeUpload: (text: string) => void;
  onUrlSubmit: (url: string) => void;
  onConversationStart: () => void;
  onVoiceStart: () => void;
  disabled?: boolean;
}

export function EntryPathSelector({
  onResumeUpload,
  onUrlSubmit,
  onConversationStart,
  onVoiceStart,
  disabled = false,
}: EntryPathSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // For MVP: read the file as text or send to extraction endpoint
      // PDF text extraction would be handled server-side in production
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/internal/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        onResumeUpload(data.text || `[Uploaded file: ${file.name}]`);
      } else {
        // Fallback: just notify that a file was uploaded
        onResumeUpload(`[Uploaded resume: ${file.name}. Please extract what you can from the conversation instead.]`);
      }
    } catch {
      onResumeUpload(`[Uploaded resume: ${file.name}. Please ask me about my background.]`);
    } finally {
      setUploading(false);
    }
  }

  function handleUrlSubmit() {
    if (urlInput.trim()) {
      onUrlSubmit(urlInput.trim());
      setShowUrlInput(false);
      setUrlInput('');
    }
  }

  const paths = [
    {
      icon: '📄',
      label: 'Upload Resume',
      sublabel: 'PDF or image',
      action: () => fileInputRef.current?.click(),
    },
    {
      icon: '🔗',
      label: 'Share a Link',
      sublabel: 'GitHub, LinkedIn, etc.',
      action: () => setShowUrlInput(true),
    },
    {
      icon: '💬',
      label: 'Just Chat',
      sublabel: 'Tell me about yourself',
      action: onConversationStart,
    },
    {
      icon: '🎙️',
      label: 'Voice Message',
      sublabel: 'Speak naturally',
      action: onVoiceStart,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {paths.map((path, i) => (
          <motion.div
            key={path.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 0.1 }}
          >
            <Button
              variant="outline"
              className="h-auto w-full flex-col gap-1 border-border/50 bg-card/50 px-4 py-4 hover:bg-card/80"
              onClick={path.action}
              disabled={disabled || uploading}
            >
              <span className="text-xl">{path.icon}</span>
              <span className="text-sm font-medium">{path.label}</span>
              <span className="text-[11px] text-muted-foreground">{path.sublabel}</span>
            </Button>
          </motion.div>
        ))}
      </div>

      {showUrlInput && (
        <motion.div
          className="flex gap-2"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <input
            type="url"
            placeholder="https://github.com/username or LinkedIn URL..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
            className="flex-1 rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            autoFocus
          />
          <Button size="sm" onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
            Go
          </Button>
        </motion.div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create voice input component**

Create `src/components/onboarding/voice-input.tsx`:

```typescript
'use client';

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled = false }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        onTranscript(transcript);
      }
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  if (!isSupported) {
    return (
      <span className="text-xs text-muted-foreground">
        Voice input not supported in this browser
      </span>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled}
      className="relative"
      title={isRecording ? 'Stop recording' : 'Start voice input'}
    >
      {isRecording && (
        <motion.span
          className="absolute inset-0 rounded-md bg-red-500/20"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
      <span className="relative z-10">{isRecording ? '⏹️' : '🎙️'}</span>
    </Button>
  );
}
```

- [ ] **Step 3: Add Web Speech API type declarations**

Create `src/types/speech.d.ts`:

```typescript
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

declare var SpeechRecognition: {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
};

interface Window {
  SpeechRecognition: typeof SpeechRecognition;
  webkitSpeechRecognition: typeof SpeechRecognition;
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(onboarding): add entry path selector, voice input, and speech types"
```

---

### Task 6: Profile Panel (Fog-Clearing Right Side)

**Files:**
- Create: `src/components/onboarding/profile-panel.tsx`

- [ ] **Step 1: Create profile panel component**

Create `src/components/onboarding/profile-panel.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { FogSection } from './fog-section';
import { SkillTag } from './skill-tag';
import { AIAvatar } from './ai-avatar';
import type { OnboardingContext } from '@/lib/ai/prompts/onboarding';

interface ProfilePanelProps {
  context: OnboardingContext;
  revealedFields: Set<string>;
}

export function ProfilePanel({ context, revealedFields }: ProfilePanelProps) {
  const hasAnyReveal = revealedFields.size > 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-card/30 p-6">
      {/* Profile Header */}
      <div className="mb-6 flex items-center gap-4">
        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-600/20 text-2xl font-bold text-violet-300"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: hasAnyReveal ? 1 : 0.3 }}
          transition={{ duration: 0.6 }}
        >
          {context.displayName?.[0]?.toUpperCase() || '?'}
        </motion.div>
        <div className="flex-1">
          <FogSection revealed={revealedFields.has('displayName')} label="Name">
            <h2 className="text-xl font-bold text-foreground">
              {context.displayName || 'Your Name'}
            </h2>
          </FogSection>
          <FogSection revealed={revealedFields.has('headline')} label="Title" delay={0.1}>
            <p className="text-sm text-muted-foreground">
              {context.headline || 'Your Professional Title'}
            </p>
          </FogSection>
        </div>
      </div>

      {/* Bio */}
      <FogSection revealed={revealedFields.has('bio')} label="About">
        <p className="text-sm leading-relaxed text-foreground/80">
          {context.bio || 'A brief professional summary will appear here as we chat.'}
        </p>
      </FogSection>

      {/* Skills */}
      <div className="mb-4">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
          Skills
        </span>
        {context.skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {/* Group by category */}
            {Object.entries(groupSkillsByCategory(context.skills)).map(([category, skills]) => (
              <div key={category} className="mb-3 w-full">
                <span className="mb-1 block text-[11px] text-muted-foreground/50">{category}</span>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((skill, i) => (
                    <SkillTag
                      key={skill.name}
                      name={skill.name}
                      level={skill.level as 'beginner' | 'intermediate' | 'advanced' | 'expert'}
                      category={skill.category}
                      index={i}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-muted/20" />
            ))}
          </div>
        )}
      </div>

      {/* Experience */}
      <FogSection revealed={revealedFields.has('experience')} label="Experience">
        {context.experience.length > 0 ? (
          <div className="space-y-3">
            {context.experience.map((exp, i) => (
              <motion.div
                key={`${exp.company}-${exp.role}`}
                className="rounded-lg border border-border/30 bg-background/50 p-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{exp.role}</p>
                    <p className="text-xs text-muted-foreground">{exp.company}</p>
                  </div>
                  <span className="text-xs text-muted-foreground/60">{exp.duration}</span>
                </div>
                {exp.description && (
                  <p className="mt-1.5 text-xs leading-relaxed text-foreground/60">
                    {exp.description}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="h-16 animate-pulse rounded-lg bg-muted/15" />
            <div className="h-16 animate-pulse rounded-lg bg-muted/10" />
          </div>
        )}
      </FogSection>

      {/* Goals */}
      <FogSection revealed={revealedFields.has('goals')} label="Goals">
        {context.goals.targetRoles?.length ? (
          <div className="space-y-2">
            <div>
              <span className="text-xs text-muted-foreground/60">Target Roles</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {context.goals.targetRoles.map((role) => (
                  <span
                    key={role}
                    className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
            {context.goals.workPreferences?.length ? (
              <div>
                <span className="text-xs text-muted-foreground/60">Work Preferences</span>
                <p className="text-xs text-foreground/60">
                  {context.goals.workPreferences.join(', ')}
                </p>
              </div>
            ) : null}
            {context.goals.motivation && (
              <div>
                <span className="text-xs text-muted-foreground/60">Motivation</span>
                <p className="text-xs text-foreground/60">{context.goals.motivation}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="h-12 animate-pulse rounded-lg bg-muted/15" />
        )}
      </FogSection>

      {/* Availability */}
      <FogSection revealed={revealedFields.has('availability')} label="Availability">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              context.availability === 'open'
                ? 'bg-green-400'
                : context.availability === 'busy'
                  ? 'bg-yellow-400'
                  : 'bg-gray-400'
            }`}
          />
          <span className="text-sm capitalize text-foreground/80">
            {context.availability || 'Unknown'}
          </span>
        </div>
      </FogSection>
    </div>
  );
}

function groupSkillsByCategory(
  skills: Array<{ name: string; level: string; category: string }>
): Record<string, Array<{ name: string; level: string; category: string }>> {
  return skills.reduce(
    (groups, skill) => {
      const cat = skill.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(skill);
      return groups;
    },
    {} as Record<string, Array<{ name: string; level: string; category: string }>>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(onboarding): add fog-clearing profile panel with grouped skills and experience cards"
```

---

### Task 7: Chat Panel (Left Side)

**Files:**
- Create: `src/components/onboarding/chat-panel.tsx`

- [ ] **Step 1: Create chat panel component**

Create `src/components/onboarding/chat-panel.tsx`:

```typescript
'use client';

import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AIAvatar } from './ai-avatar';
import { EntryPathSelector } from './entry-path-selector';
import { VoiceInput } from './voice-input';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  streamingContent: string;
  isLoading: boolean;
  showEntryPaths: boolean;
  onSendMessage: (message: string) => void;
  onResumeUpload: (text: string) => void;
  onUrlSubmit: (url: string) => void;
  onConversationStart: () => void;
  onVoiceStart: () => void;
}

export function ChatPanel({
  messages,
  streamingContent,
  isLoading,
  showEntryPaths,
  onSendMessage,
  onResumeUpload,
  onUrlSubmit,
  onConversationStart,
  onVoiceStart,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput('');
  }

  function handleVoiceTranscript(text: string) {
    onSendMessage(text);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        {messages.length === 0 && !streamingContent && (
          <motion.div
            className="flex flex-col items-center pt-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <AIAvatar size="lg" />
            <motion.p
              className="mt-6 max-w-sm text-center font-serif text-lg text-foreground/80"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              Welcome to Cyber Silicon Valley
            </motion.p>
          </motion.div>
        )}

        <div className="mx-auto max-w-xl space-y-4">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {msg.role === 'assistant' && <AIAvatar size="sm" animate={false} />}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card/60 text-foreground/90'
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}

          {/* Streaming content */}
          {streamingContent && (
            <div className="flex gap-3">
              <AIAvatar size="sm" animate={false} />
              <div className="max-w-[80%] rounded-2xl bg-card/60 px-4 py-2.5 text-sm leading-relaxed text-foreground/90">
                {streamingContent}
                <motion.span
                  className="ml-0.5 inline-block h-4 w-0.5 bg-foreground/50"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && !streamingContent && (
            <div className="flex gap-3">
              <AIAvatar size="sm" animate={false} />
              <div className="rounded-2xl bg-card/60 px-4 py-3">
                <motion.div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </motion.div>
              </div>
            </div>
          )}

          {/* Entry paths — shown after initial AI greeting */}
          {showEntryPaths && (
            <div className="mt-6">
              <EntryPathSelector
                onResumeUpload={onResumeUpload}
                onUrlSubmit={onUrlSubmit}
                onConversationStart={onConversationStart}
                onVoiceStart={onVoiceStart}
                disabled={isLoading}
              />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border/30 bg-background/80 px-6 py-4 backdrop-blur">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-xl items-center gap-2">
          <VoiceInput onTranscript={handleVoiceTranscript} disabled={isLoading} />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-border/40 bg-card/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-card"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isLoading}
            className="px-4"
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(onboarding): add chat panel with streaming display, voice input, and entry paths"
```

---

### Task 8: Guided Tour Overlay

**Files:**
- Create: `src/components/onboarding/guided-tour.tsx`

- [ ] **Step 1: Create guided tour component**

Create `src/components/onboarding/guided-tour.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface TourStep {
  title: string;
  description: string;
  icon: string;
  route: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Home',
    description: 'Your professional identity — your capability portrait, experience, and profile live here.',
    icon: '🏠',
    route: '/talent/home',
  },
  {
    title: 'AI Coach',
    description: 'Your personal career coach — resume review, mock interviews, skill gap analysis, all powered by AI.',
    icon: '🎯',
    route: '/talent/coach',
  },
  {
    title: 'Seeking Report',
    description: 'Your AI works 24/7 scanning opportunities. Check daily reports with curated matches and pre-chat summaries.',
    icon: '📊',
    route: '/talent/seeking',
  },
  {
    title: 'Opportunity Fair',
    description: 'Explore the market through an interactive keyword graph. Discover trends, find companies, and spot opportunities.',
    icon: '🗺️',
    route: '/talent/fair',
  },
];

interface GuidedTourProps {
  onComplete: () => void;
}

export function GuidedTour({ onComplete }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      onComplete();
      router.push('/talent/home');
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }

  function handleSkip() {
    onComplete();
    router.push('/talent/home');
  }

  if (!step) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          className="mx-4 w-full max-w-md rounded-2xl border border-border/30 bg-card p-8 shadow-2xl"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {/* Progress dots */}
          <div className="mb-6 flex justify-center gap-2">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep
                    ? 'w-6 bg-primary'
                    : i < currentStep
                      ? 'w-1.5 bg-primary/50'
                      : 'w-1.5 bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="text-center">
            <span className="text-4xl">{step.icon}</span>
            <h3 className="mt-4 font-serif text-xl font-bold text-foreground">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </div>

          {/* Actions */}
          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
              Skip tour
            </Button>
            <Button onClick={handleNext} size="sm">
              {isLast ? 'Get Started' : 'Next'}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(onboarding): add guided tour overlay with step-through animation"
```

---

### Task 9: Onboarding Client Component (Split Screen Orchestrator)

**Files:**
- Create: `src/app/talent/onboarding/onboarding-client.tsx`

- [ ] **Step 1: Create onboarding client component**

Create `src/app/talent/onboarding/onboarding-client.tsx`:

```typescript
'use client';

import { useState, useCallback, useRef } from 'react';
import { useChat } from 'ai/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatPanel } from '@/components/onboarding/chat-panel';
import { ProfilePanel } from '@/components/onboarding/profile-panel';
import { GuidedTour } from '@/components/onboarding/guided-tour';
import type { OnboardingContext } from '@/lib/ai/prompts/onboarding';
import { INITIAL_ONBOARDING_CONTEXT } from '@/lib/ai/prompts/onboarding';

export function OnboardingClient() {
  const [profileContext, setProfileContext] = useState<OnboardingContext>({
    ...INITIAL_ONBOARDING_CONTEXT,
  });
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());
  const [showTour, setShowTour] = useState(false);
  const [showEntryPaths, setShowEntryPaths] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const entryMethodRef = useRef<string | null>(null);

  const {
    messages,
    input,
    isLoading,
    append,
    setInput,
  } = useChat({
    api: '/api/internal/ai/onboarding',
    onFinish: (message) => {
      // Process tool invocations from the message
      if (message.toolInvocations) {
        for (const invocation of message.toolInvocations) {
          if (invocation.state !== 'result') continue;

          if (invocation.toolName === 'revealProfileField') {
            const { field, value } = invocation.args as { field: string; value: unknown };
            setProfileContext((prev) => ({
              ...prev,
              [field]: value,
            }));
            setRevealedFields((prev) => new Set(prev).add(field));
          }

          if (invocation.toolName === 'addSkillTag') {
            const { name, level, category } = invocation.args as {
              name: string;
              level: string;
              category: string;
            };
            setProfileContext((prev) => ({
              ...prev,
              skills: [...prev.skills, { name, level, category }],
            }));
            // Skills section doesn't use fog — individual tags animate in
          }

          if (invocation.toolName === 'completeOnboarding') {
            setShowTour(true);
          }
        }
      }
    },
  });

  // Send initial greeting when component mounts
  const initializeChat = useCallback(() => {
    if (hasStarted) return;
    setHasStarted(true);
    append({
      role: 'user',
      content: '[System: The user has just arrived at the onboarding screen. Send your greeting and introduce the entry paths.]',
    });
    // Show entry paths after a delay to let the AI greeting stream in
    setTimeout(() => setShowEntryPaths(true), 2000);
  }, [hasStarted, append]);

  // Auto-start on mount
  useState(() => {
    initializeChat();
  });

  function handleSendMessage(text: string) {
    setShowEntryPaths(false);
    append({
      role: 'user',
      content: text,
    });
  }

  function handleResumeUpload(text: string) {
    setShowEntryPaths(false);
    entryMethodRef.current = 'resume';
    append({
      role: 'user',
      content: `I've uploaded my resume. Here's the content:\n\n${text}\n\nPlease extract my profile information from this.`,
    }, {
      body: {
        entryMethod: 'resume',
        resumeText: text,
      },
    });
  }

  function handleUrlSubmit(url: string) {
    setShowEntryPaths(false);
    entryMethodRef.current = 'url';
    append({
      role: 'user',
      content: `Here's my profile link: ${url}. Please use this to learn about me.`,
    }, {
      body: {
        entryMethod: 'url',
        urlContent: `[URL provided: ${url}. For MVP, please ask the user about their background based on what a typical profile at this URL might contain.]`,
      },
    });
  }

  function handleConversationStart() {
    setShowEntryPaths(false);
    entryMethodRef.current = 'conversation';
    append({
      role: 'user',
      content: "I'd like to just introduce myself through conversation. Let's chat!",
    }, {
      body: {
        entryMethod: 'conversation',
      },
    });
  }

  function handleVoiceStart() {
    setShowEntryPaths(false);
    entryMethodRef.current = 'voice';
    // Voice input is handled by the VoiceInput component which calls onSendMessage
  }

  // Convert useChat messages to ChatPanel format
  const chatMessages = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .filter((m) => !m.content.startsWith('[System:'))
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  // Get streaming content from the last assistant message if it's still loading
  const lastMessage = messages[messages.length - 1];
  const streamingContent =
    isLoading && lastMessage?.role === 'assistant' ? '' : '';

  return (
    <>
      <div className="flex h-screen w-screen bg-background">
        {/* Left: Chat */}
        <motion.div
          className="flex w-1/2 flex-col border-r border-border/20"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <ChatPanel
            messages={chatMessages}
            streamingContent={streamingContent}
            isLoading={isLoading}
            showEntryPaths={showEntryPaths}
            onSendMessage={handleSendMessage}
            onResumeUpload={handleResumeUpload}
            onUrlSubmit={handleUrlSubmit}
            onConversationStart={handleConversationStart}
            onVoiceStart={handleVoiceStart}
          />
        </motion.div>

        {/* Right: Profile Panel */}
        <motion.div
          className="w-1/2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <ProfilePanel context={profileContext} revealedFields={revealedFields} />
        </motion.div>
      </div>

      {/* Guided Tour Overlay */}
      <AnimatePresence>
        {showTour && (
          <GuidedTour onComplete={() => setShowTour(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(onboarding): add split-screen orchestrator with useChat integration and tool call processing"
```

---

### Task 10: Onboarding Page (Server Component + Redirect Logic)

**Files:**
- Create: `src/app/talent/onboarding/page.tsx`

- [ ] **Step 1: Create onboarding page with auth + redirect logic**

Create `src/app/talent/onboarding/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { talentProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { OnboardingClient } from './onboarding-client';

export const metadata = {
  title: 'Welcome to CSV — Onboarding',
};

export default async function OnboardingPage() {
  // Check auth
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    redirect('/login');
  }

  let auth;
  try {
    auth = await verifyJWT(token);
  } catch {
    redirect('/login');
  }

  if (auth.role !== 'talent') {
    redirect('/login');
  }

  // Check if already onboarded
  const [profile] = await db
    .select({ onboardingDone: talentProfiles.onboardingDone })
    .from(talentProfiles)
    .where(eq(talentProfiles.userId, auth.userId))
    .limit(1);

  if (profile?.onboardingDone) {
    redirect('/talent/home');
  }

  return <OnboardingClient />;
}
```

- [ ] **Step 2: Ensure the route is outside the (talent) layout group**

The route is at `src/app/talent/onboarding/page.tsx` — **not** inside `src/app/(talent)/`. This is important because the onboarding page is full-screen with no sidebar or companion bar. The `(talent)` route group wraps pages in the talent layout shell. Placing the onboarding page at `/talent/onboarding` outside the route group ensures it gets only the root layout.

Verify the file is at the correct path (not inside parenthesized group):
- Correct: `src/app/talent/onboarding/page.tsx`
- Wrong: `src/app/(talent)/onboarding/page.tsx`

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(onboarding): add onboarding page with auth check and onboarded-user redirect"
```

---

### Task 11: Add i18n Strings for Onboarding

**Files:**
- Modify: `src/i18n/messages/en.json`
- Modify: `src/i18n/messages/zh.json`

- [ ] **Step 1: Add onboarding strings to en.json**

Add to `src/i18n/messages/en.json` (add `"onboarding"` key at root level):

```json
{
  "onboarding": {
    "welcome": "Welcome to Cyber Silicon Valley",
    "uploadResume": "Upload Resume",
    "uploadResumeDesc": "PDF or image",
    "shareLink": "Share a Link",
    "shareLinkDesc": "GitHub, LinkedIn, etc.",
    "justChat": "Just Chat",
    "justChatDesc": "Tell me about yourself",
    "voiceMessage": "Voice Message",
    "voiceMessageDesc": "Speak naturally",
    "sendMessage": "Send",
    "typePlaceholder": "Type a message...",
    "profileName": "Name",
    "profileTitle": "Title",
    "profileAbout": "About",
    "profileSkills": "Skills",
    "profileExperience": "Experience",
    "profileGoals": "Goals",
    "profileAvailability": "Availability",
    "tourSkip": "Skip tour",
    "tourNext": "Next",
    "tourStart": "Get Started"
  }
}
```

- [ ] **Step 2: Add onboarding strings to zh.json**

Add to `src/i18n/messages/zh.json` (add `"onboarding"` key at root level):

```json
{
  "onboarding": {
    "welcome": "欢迎来到 Cyber Silicon Valley",
    "uploadResume": "上传简历",
    "uploadResumeDesc": "PDF 或图片",
    "shareLink": "分享链接",
    "shareLinkDesc": "GitHub、LinkedIn 等",
    "justChat": "直接聊天",
    "justChatDesc": "介绍一下你自己",
    "voiceMessage": "语音消息",
    "voiceMessageDesc": "自然地说话",
    "sendMessage": "发送",
    "typePlaceholder": "输入消息...",
    "profileName": "姓名",
    "profileTitle": "职称",
    "profileAbout": "简介",
    "profileSkills": "技能",
    "profileExperience": "经验",
    "profileGoals": "目标",
    "profileAvailability": "状态",
    "tourSkip": "跳过引导",
    "tourNext": "下一步",
    "tourStart": "开始使用"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(onboarding): add bilingual i18n strings for onboarding UI"
```

---

### Task 12: Wire Login Redirect to Onboarding

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/lib/auth/middleware.ts`

- [ ] **Step 1: Update login page to redirect to onboarding for new talent users**

In the login page's `handleLogin` function, after successful login, check if the user needs onboarding:

Find the section in `src/app/(auth)/login/page.tsx` where the login success redirects (inside `handleLogin`, after `const data = await res.json()`). Update the redirect logic:

```typescript
      if (!res.ok) {
        setError(data.message || t('invalidCredentials'));
        return;
      }

      // Redirect based on role and onboarding status
      if (data.user.role === 'talent') {
        // Check onboarding status via a quick fetch
        const profileRes = await fetch('/api/internal/onboarding-status');
        const profileData = await profileRes.json();
        if (profileData.onboardingDone) {
          router.push('/talent/home');
        } else {
          router.push('/talent/onboarding');
        }
      } else {
        router.push('/enterprise/dashboard');
      }
```

- [ ] **Step 2: Create onboarding status endpoint**

Create `src/app/api/internal/onboarding-status/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { talentProfiles, enterpriseProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (auth.role === 'talent') {
    const [profile] = await db
      .select({ onboardingDone: talentProfiles.onboardingDone })
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, auth.userId))
      .limit(1);

    return NextResponse.json({ onboardingDone: profile?.onboardingDone ?? false });
  }

  if (auth.role === 'enterprise') {
    const [profile] = await db
      .select({ onboardingDone: enterpriseProfiles.onboardingDone })
      .from(enterpriseProfiles)
      .where(eq(enterpriseProfiles.userId, auth.userId))
      .limit(1);

    return NextResponse.json({ onboardingDone: profile?.onboardingDone ?? false });
  }

  return NextResponse.json({ onboardingDone: false });
}
```

- [ ] **Step 3: Update auth middleware to allow onboarding route**

In `src/lib/auth/middleware.ts`, update the `createAuthMiddleware` function to allow the `/talent/onboarding` route for talent users (it's outside the `(talent)` route group but still needs auth). Add to the public routes check:

```typescript
    // Public routes
    if (
      path === '/' ||
      path.startsWith('/login') ||
      path.startsWith('/api/v1/auth')
    ) {
      return NextResponse.next();
    }

    const auth = await getAuthFromRequest(req);

    if (!auth) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Onboarding routes — talent can access /talent/onboarding
    if (path === '/talent/onboarding') {
      if (auth.role !== 'talent') {
        return NextResponse.redirect(new URL('/login', req.url));
      }
      const response = NextResponse.next();
      response.headers.set('x-user-id', auth.userId);
      response.headers.set('x-user-role', auth.role);
      response.headers.set('x-user-email', auth.email);
      return response;
    }

    // Role-based routing
    if (path.startsWith('/talent') && auth.role !== 'talent') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    if (path.startsWith('/enterprise') && auth.role !== 'enterprise') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(onboarding): wire login redirect to onboarding for new talent users"
```

---

### Task 13: End-to-End Smoke Test

**Files:**
- No new files — manual verification

- [ ] **Step 1: Start dev server and test the full flow**

```bash
npm run dev
```

1. Open browser to `http://localhost:3000`
2. Log in as `talent1@csv.dev` / `csv2026`
3. Verify redirect to `/talent/onboarding`
4. Verify AI greeting appears with streaming text
5. Verify entry path buttons display after greeting
6. Click "Just Chat" and respond with a name and role
7. Verify `revealProfileField` tool calls trigger fog-clearing animation on the right panel
8. Continue conversation through skills, experience, goals
9. Verify each section reveals with blur-to-clear animation
10. Verify skill tags animate in one-by-one with stagger
11. After `completeOnboarding`, verify guided tour overlay appears
12. Click through tour steps and verify final redirect to `/talent/home`
13. Visit `/talent/onboarding` again — verify redirect to `/talent/home` (already onboarded)

- [ ] **Step 2: Run typecheck and lint**

```bash
npm run check
```

Fix any errors.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(onboarding): resolve typecheck and lint issues from smoke test"
```
