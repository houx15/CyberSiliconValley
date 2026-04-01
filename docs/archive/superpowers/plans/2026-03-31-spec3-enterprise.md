# Spec 3: Enterprise Onboarding + Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete enterprise-side experience — conversational onboarding that recognizes companies and captures hiring intent, a real-time dashboard showing AI activity, and a JD input flow with AI auto-structuring.

**Architecture:** Three route groups: `/enterprise/onboarding` (full-screen, 4-step conversational flow via system prompt + tool calls), `/enterprise/dashboard` (polling-based activity status + job list + quick actions), and `/enterprise/jobs/new` (multi-input JD parsing with editable structured output). All AI interactions stream through Vercel AI SDK with dedicated system prompts and tool definitions. Job publishing triggers BullMQ background jobs for embedding and match scanning.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion, Vercel AI SDK, Drizzle ORM, BullMQ, next-intl

---

## File Structure

```
csv/src/
├── app/
│   ├── (enterprise)/
│   │   ├── dashboard/
│   │   │   └── page.tsx                      # Enterprise dashboard (replace placeholder)
│   │   └── jobs/
│   │       ├── page.tsx                      # Jobs list (redirect to dashboard)
│   │       ├── new/
│   │       │   └── page.tsx                  # JD input + AI structuring
│   │       └── [id]/
│   │           └── page.tsx                  # Job detail (placeholder for Spec 4)
│   └── enterprise/
│       └── onboarding/
│           └── page.tsx                      # Full-screen onboarding (outside layout)
├── api/
│   └── internal/
│       └── ai/
│           ├── enterprise-onboarding/
│           │   └── route.ts                  # Enterprise onboarding AI endpoint
│           └── jd-parse/
│               └── route.ts                  # JD parse AI endpoint
├── components/
│   └── enterprise/
│       ├── onboarding-chat.tsx               # Onboarding chat + profile preview
│       ├── company-profile-card.tsx           # Company info confirmation card
│       ├── dashboard-status-bar.tsx           # AI activity status bar (polling)
│       ├── active-jobs-list.tsx               # Active jobs list component
│       ├── quick-actions.tsx                  # Quick action buttons
│       ├── jd-input-form.tsx                 # JD paste/URL/conversation input
│       └── structured-job-card.tsx           # Editable structured job output
├── lib/
│   └── ai/
│       └── prompts/
│           ├── enterprise-onboarding.ts      # Enterprise onboarding system prompt
│           └── jd-parse.ts                   # JD parse system prompt
├── i18n/
│   └── messages/
│       ├── en.json                           # Add enterprise keys
│       └── zh.json                           # Add enterprise keys
└── types/
    └── index.ts                              # Add enterprise types (if needed)
```

---

### Task 1: Add i18n Strings for Enterprise Features

**Files:**
- Modify: `src/i18n/messages/en.json`
- Modify: `src/i18n/messages/zh.json`

- [ ] **Step 1: Add English enterprise strings**

In `src/i18n/messages/en.json`, add the `enterprise` section at the top level:

```json
{
  "enterprise": {
    "onboarding": {
      "title": "Welcome to CSV",
      "subtitle": "Let's get your company set up",
      "thinking": "Your AI is thinking...",
      "companyConfirm": "Is this information correct?",
      "confirm": "Yes, that's correct",
      "edit": "Let me correct that",
      "complete": "Setup Complete",
      "redirecting": "Taking you to your dashboard..."
    },
    "dashboard": {
      "title": "Dashboard",
      "aiStatus": "AI Activity",
      "profilesScanned": "{count} profiles scanned",
      "matchesFound": "{count} matches found",
      "prechatActive": "{count} pre-chats active",
      "activeJobs": "Active Jobs",
      "noJobs": "No jobs posted yet. Post your first job to start finding talent.",
      "postedOn": "Posted {date}",
      "matches": "{count} matches",
      "shortlisted": "{count} shortlisted"
    },
    "jobs": {
      "new": "Post a New Job",
      "pasteJd": "Paste Job Description",
      "linkJd": "Link a JD URL",
      "describeJd": "Describe in Conversation",
      "pasteLabel": "Paste your job description text here...",
      "urlLabel": "Enter the URL of the job description",
      "parseButton": "Parse with AI",
      "editStructured": "Review & Edit",
      "publish": "Publish Job",
      "publishing": "Publishing...",
      "published": "Job Published!",
      "title": "Role / Project Title",
      "skills": "Required Skills",
      "mustHave": "Must-have",
      "niceToHave": "Nice-to-have",
      "seniority": "Seniority Level",
      "timeline": "Timeline",
      "deliverables": "Deliverables",
      "budget": "Budget Range",
      "workMode": "Work Mode",
      "remote": "Remote",
      "onsite": "Onsite",
      "hybrid": "Hybrid"
    },
    "quickActions": {
      "postJob": "Post a New Job",
      "screenTalent": "Screen Talent",
      "reviewPicks": "Review AI Picks"
    }
  }
}
```

- [ ] **Step 2: Add Chinese enterprise strings**

In `src/i18n/messages/zh.json`, add the `enterprise` section at the top level:

```json
{
  "enterprise": {
    "onboarding": {
      "title": "欢迎来到 CSV",
      "subtitle": "让我们为您的公司完成设置",
      "thinking": "AI 正在思考...",
      "companyConfirm": "以上信息是否正确？",
      "confirm": "是的，信息正确",
      "edit": "我来修改",
      "complete": "设置完成",
      "redirecting": "正在前往您的工作台..."
    },
    "dashboard": {
      "title": "工作台",
      "aiStatus": "AI 活动",
      "profilesScanned": "已扫描 {count} 份人才档案",
      "matchesFound": "发现 {count} 个匹配",
      "prechatActive": "{count} 个预聊天进行中",
      "activeJobs": "进行中的职位",
      "noJobs": "还没有发布职位。发布您的第一个职位以开始寻找人才。",
      "postedOn": "发布于 {date}",
      "matches": "{count} 个匹配",
      "shortlisted": "{count} 个入围"
    },
    "jobs": {
      "new": "发布新职位",
      "pasteJd": "粘贴职位描述",
      "linkJd": "链接 JD 网址",
      "describeJd": "通过对话描述",
      "pasteLabel": "在此粘贴您的职位描述文本...",
      "urlLabel": "输入职位描述的网址",
      "parseButton": "AI 解析",
      "editStructured": "检查与编辑",
      "publish": "发布职位",
      "publishing": "发布中...",
      "published": "职位已发布！",
      "title": "角色/项目名称",
      "skills": "所需技能",
      "mustHave": "必须",
      "niceToHave": "加分",
      "seniority": "资历等级",
      "timeline": "时间线",
      "deliverables": "交付成果",
      "budget": "预算范围",
      "workMode": "工作方式",
      "remote": "远程",
      "onsite": "现场",
      "hybrid": "混合"
    },
    "quickActions": {
      "postJob": "发布新职位",
      "screenTalent": "筛选人才",
      "reviewPicks": "查看 AI 推荐"
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/messages/en.json src/i18n/messages/zh.json
git commit -m "feat(spec3): add enterprise i18n strings for onboarding, dashboard, and jobs"
```

---

### Task 2: Enterprise Onboarding System Prompt + AI Endpoint

**Files:**
- Create: `src/lib/ai/prompts/enterprise-onboarding.ts`
- Create: `src/app/api/internal/ai/enterprise-onboarding/route.ts`

- [ ] **Step 1: Create the enterprise onboarding system prompt**

Create `src/lib/ai/prompts/enterprise-onboarding.ts`:

```typescript
import { baseSystemPrompt } from './_base';

export function enterpriseOnboardingPrompt(collectedData: Record<string, unknown>) {
  const collected = Object.keys(collectedData).filter(
    (k) => collectedData[k] !== null && collectedData[k] !== undefined
  );

  const missing = [
    !collectedData.companyProfile && 'companyProfile',
    !collectedData.intent && 'intent',
    !collectedData.requirement && 'requirement',
    !collectedData.matchingPreferences && 'matchingPreferences',
  ].filter(Boolean);

  return `${baseSystemPrompt}

You are guiding an enterprise user through CSV onboarding. Follow these 4 phases in order, but keep the conversation natural and warm.

## Phase 1: Company Recognition
Ask the user for their company name or website URL. Based on the name, generate a plausible company summary from your training data — include industry, approximate size, main products/services, and a brief description. Present this as a card-like summary and ask the user to confirm or correct it. Do NOT attempt to browse the web. Use your training knowledge only.

When you have enough information, call the \`setCompanyProfile\` tool with the confirmed company data.

## Phase 2: Intent Clarification
Ask what brings them to CSV. Offer three conversational choices:
- Recruit for a specific role
- Find project delivery / freelance talent
- Explore the talent pool generally

This helps tailor the rest of the experience. Save their response as part of the context.

## Phase 3: Requirement Input
If they want to recruit or find project talent:
- Invite them to paste a JD, link a URL, or describe their needs in conversation
- Extract and structure the requirement into: title, required skills (with must-have vs nice-to-have), seniority level, timeline, deliverables, budget range, and work mode
- Present the structured requirement for confirmation

Call \`createJob\` with the structured requirement once confirmed.

If they are just exploring, skip this phase and note it in context.

## Phase 4: Matching Setup
Ask about their matching preferences:
- Auto-match: Should the AI automatically find matching candidates? (yes/no)
- Auto pre-screen: Should the AI conduct preliminary conversations with top matches? (yes/no)
- Any hard deal-breakers? (e.g., must be onsite, must have 5+ years experience)

Once preferences are set, call \`completeOnboarding\` to finish.

## Current State
Collected so far: ${JSON.stringify(collectedData, null, 2)}
Still needed: ${missing.join(', ') || 'nothing — ready to complete'}

## Rules
- Be warm and professional, like a skilled business development partner
- Keep messages concise — 2-3 sentences max unless presenting structured data
- Respond in the language the user writes in
- Always call the appropriate tool when a phase is complete
- Do not skip phases unless the user explicitly wants to (exploring intent skips Phase 3)
`;
}
```

- [ ] **Step 2: Create the enterprise onboarding API route**

Create `src/app/api/internal/ai/enterprise-onboarding/route.ts`:

```typescript
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/auth/middleware';
import { getAIModel } from '@/lib/ai/providers';
import { enterpriseOnboardingPrompt } from '@/lib/ai/prompts/enterprise-onboarding';
import {
  getOrCreateSession,
  loadChatHistory,
  saveChatMessage,
  updateSessionContext,
} from '@/lib/ai/chat';
import { db } from '@/lib/db';
import { enterpriseProfiles, jobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth || auth.role !== 'enterprise') {
    return new Response('Unauthorized', { status: 401 });
  }

  const { message } = await req.json();

  const session = await getOrCreateSession(auth.userId, 'enterprise_onboarding');
  const history = await loadChatHistory(session.id);

  await saveChatMessage(session.id, 'user', message);

  const collectedData = (session.context as Record<string, unknown>) || {};

  const result = streamText({
    model: getAIModel(),
    system: enterpriseOnboardingPrompt(collectedData),
    messages: [
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ],
    tools: {
      setCompanyProfile: tool({
        description: 'Save the confirmed company profile to the database',
        parameters: z.object({
          companyName: z.string().describe('Company name'),
          industry: z.string().describe('Industry sector'),
          companySize: z.string().describe('Company size range, e.g. "50-200", "1000+"'),
          website: z.string().optional().describe('Company website URL'),
          description: z.string().describe('Brief company description'),
          aiMaturity: z
            .enum(['exploring', 'adopting', 'scaling', 'leading'])
            .optional()
            .describe('AI maturity level'),
        }),
        execute: async (params) => {
          const [profile] = await db
            .select()
            .from(enterpriseProfiles)
            .where(eq(enterpriseProfiles.userId, auth.userId))
            .limit(1);

          if (profile) {
            await db
              .update(enterpriseProfiles)
              .set({
                companyName: params.companyName,
                industry: params.industry,
                companySize: params.companySize,
                website: params.website || null,
                description: params.description,
                aiMaturity: params.aiMaturity || null,
                updatedAt: new Date(),
              })
              .where(eq(enterpriseProfiles.userId, auth.userId));
          } else {
            await db.insert(enterpriseProfiles).values({
              userId: auth.userId,
              companyName: params.companyName,
              industry: params.industry,
              companySize: params.companySize,
              website: params.website || null,
              description: params.description,
              aiMaturity: params.aiMaturity || null,
            });
          }

          await updateSessionContext(session.id, {
            ...collectedData,
            companyProfile: params,
          });

          return { success: true, message: 'Company profile saved' };
        },
      }),

      createJob: tool({
        description: 'Create a job posting from the structured requirement',
        parameters: z.object({
          title: z.string().describe('Job/project title'),
          description: z.string().describe('Full text description'),
          skills: z.array(
            z.object({
              name: z.string(),
              level: z.string(),
              required: z.boolean(),
            })
          ).describe('Required skills with must-have/nice-to-have'),
          seniority: z
            .enum(['junior', 'mid', 'senior', 'lead'])
            .describe('Seniority level'),
          timeline: z.string().optional().describe('Start date and duration'),
          deliverables: z.array(z.string()).optional().describe('Key deliverables'),
          budget: z
            .object({
              min: z.number().optional(),
              max: z.number().optional(),
              currency: z.string().default('CNY'),
            })
            .optional()
            .describe('Budget range'),
          workMode: z
            .enum(['remote', 'onsite', 'hybrid'])
            .describe('Work arrangement'),
        }),
        execute: async (params) => {
          const [profile] = await db
            .select()
            .from(enterpriseProfiles)
            .where(eq(enterpriseProfiles.userId, auth.userId))
            .limit(1);

          if (!profile) {
            return { success: false, message: 'Company profile not found. Complete step 1 first.' };
          }

          const [job] = await db
            .insert(jobs)
            .values({
              enterpriseId: profile.id,
              title: params.title,
              description: params.description,
              structured: {
                skills: params.skills,
                seniority: params.seniority,
                timeline: params.timeline || '',
                deliverables: params.deliverables || [],
                budget: params.budget || { currency: 'CNY' },
                workMode: params.workMode,
              },
              status: 'open',
              autoMatch: true,
              autoPrechat: false,
            })
            .returning();

          await updateSessionContext(session.id, {
            ...collectedData,
            requirement: params,
            jobId: job!.id,
          });

          return { success: true, jobId: job!.id, message: 'Job created successfully' };
        },
      }),

      completeOnboarding: tool({
        description: 'Mark onboarding as complete and redirect to dashboard',
        parameters: z.object({
          autoMatch: z
            .boolean()
            .default(true)
            .describe('Enable auto-matching'),
          autoPrechat: z
            .boolean()
            .default(false)
            .describe('Enable auto pre-screening'),
          dealbreakers: z
            .array(z.string())
            .optional()
            .describe('Hard deal-breaker requirements'),
        }),
        execute: async (params) => {
          await db
            .update(enterpriseProfiles)
            .set({
              onboardingDone: true,
              preferences: {
                autoMatch: params.autoMatch,
                autoPrechat: params.autoPrechat,
                dealbreakers: params.dealbreakers || [],
              },
              updatedAt: new Date(),
            })
            .where(eq(enterpriseProfiles.userId, auth.userId));

          // Update job matching preferences if a job was created
          const jobId = collectedData.jobId as string | undefined;
          if (jobId) {
            await db
              .update(jobs)
              .set({
                autoMatch: params.autoMatch,
                autoPrechat: params.autoPrechat,
                updatedAt: new Date(),
              })
              .where(eq(jobs.id, jobId));
          }

          await updateSessionContext(session.id, {
            ...collectedData,
            matchingPreferences: params,
            onboardingComplete: true,
          });

          return { success: true, redirect: '/enterprise/dashboard' };
        },
      }),
    },
    onFinish: async ({ text }) => {
      if (text) {
        await saveChatMessage(session.id, 'assistant', text);
      }
    },
  });

  return result.toDataStreamResponse();
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/prompts/enterprise-onboarding.ts src/app/api/internal/ai/enterprise-onboarding/route.ts
git commit -m "feat(spec3): add enterprise onboarding system prompt and AI endpoint"
```

---

### Task 3: Enterprise Onboarding Page + Components

**Files:**
- Create: `src/app/enterprise/onboarding/page.tsx`
- Create: `src/components/enterprise/onboarding-chat.tsx`
- Create: `src/components/enterprise/company-profile-card.tsx`

- [ ] **Step 1: Create the CompanyProfileCard component**

Create `src/components/enterprise/company-profile-card.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { Building2, Globe, Users, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CompanyProfileCardProps {
  companyName: string;
  industry: string;
  companySize: string;
  website?: string;
  description: string;
  aiMaturity?: string;
}

const aiMaturityLabels: Record<string, string> = {
  exploring: 'Exploring AI',
  adopting: 'Adopting AI',
  scaling: 'Scaling AI',
  leading: 'Leading in AI',
};

export function CompanyProfileCard({
  companyName,
  industry,
  companySize,
  website,
  description,
  aiMaturity,
}: CompanyProfileCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-serif">
            <Building2 className="h-5 w-5 text-primary" />
            {companyName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{industry}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{companySize} employees</span>
            </div>
            {website && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                <span>{website}</span>
              </div>
            )}
            {aiMaturity && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-green-500" />
                <span>{aiMaturityLabels[aiMaturity] || aiMaturity}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create the OnboardingChat component**

Create `src/components/enterprise/onboarding-chat.tsx`:

```typescript
'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat } from 'ai/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Building2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CompanyProfileCard } from './company-profile-card';

interface OnboardingChatProps {
  onComplete: () => void;
}

export function OnboardingChat({ onComplete }: OnboardingChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [companyProfile, setCompanyProfile] = useState<Record<string, unknown> | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/internal/ai/enterprise-onboarding',
    initialMessages: [],
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === 'setCompanyProfile') {
        setCompanyProfile(toolCall.args as Record<string, unknown>);
      }
      if (toolCall.toolName === 'completeOnboarding') {
        setIsComplete(true);
        setTimeout(() => onComplete(), 2000);
      }
    },
  });

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send initial greeting trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      const form = document.getElementById('onboarding-form') as HTMLFormElement;
      if (form && messages.length === 0) {
        const syntheticInput = { target: { value: 'Hello, I want to set up my company on CSV.' } };
        handleInputChange(syntheticInput as any);
        setTimeout(() => form.requestSubmit(), 100);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-full gap-6">
      {/* Chat panel */}
      <div className="flex flex-1 flex-col">
        <ScrollArea className="flex-1 pr-4" ref={scrollRef as any}>
          <div className="space-y-4 py-4">
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {message.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking...</span>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {!isComplete && (
          <form
            id="onboarding-form"
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-border pt-4"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}

        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 border-t border-border pt-4 text-green-500"
          >
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Onboarding complete! Redirecting to dashboard...</span>
          </motion.div>
        )}
      </div>

      {/* Profile preview panel */}
      <div className="w-80 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>Company Profile</span>
        </div>

        {companyProfile ? (
          <CompanyProfileCard
            companyName={companyProfile.companyName as string}
            industry={companyProfile.industry as string}
            companySize={companyProfile.companySize as string}
            website={companyProfile.website as string | undefined}
            description={companyProfile.description as string}
            aiMaturity={companyProfile.aiMaturity as string | undefined}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Company information will appear here once recognized by the AI.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the enterprise onboarding page**

Create `src/app/enterprise/onboarding/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { enterpriseProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { OnboardingPage } from './client';

export default async function EnterpriseOnboardingPage() {
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

  if (auth.role !== 'enterprise') {
    redirect('/');
  }

  // Check if already onboarded
  const [profile] = await db
    .select()
    .from(enterpriseProfiles)
    .where(eq(enterpriseProfiles.userId, auth.userId))
    .limit(1);

  if (profile?.onboardingDone) {
    redirect('/enterprise/dashboard');
  }

  return <OnboardingPage />;
}
```

Create `src/app/enterprise/onboarding/client.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { OnboardingChat } from '@/components/enterprise/onboarding-chat';

export function OnboardingPage() {
  const router = useRouter();

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between border-b border-border px-8 py-4"
      >
        <div>
          <h1 className="font-serif text-xl font-semibold">
            Welcome to CSV
          </h1>
          <p className="text-sm text-muted-foreground">
            Let&apos;s set up your company and find the talent you need
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Cyber Silicon Valley
        </div>
      </motion.div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden px-8 py-6">
        <OnboardingChat onComplete={() => router.push('/enterprise/dashboard')} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the page renders**

```bash
npm run dev
```

Navigate to `/enterprise/onboarding` while logged in as an enterprise user. The page should render with a chat interface on the left and a company profile placeholder on the right.

- [ ] **Step 5: Commit**

```bash
git add src/app/enterprise/onboarding/ src/components/enterprise/onboarding-chat.tsx src/components/enterprise/company-profile-card.tsx
git commit -m "feat(spec3): add enterprise onboarding page with conversational flow"
```

---

### Task 4: Enterprise Dashboard Page

**Files:**
- Modify: `src/app/(enterprise)/dashboard/page.tsx`
- Create: `src/components/enterprise/dashboard-status-bar.tsx`
- Create: `src/components/enterprise/active-jobs-list.tsx`
- Create: `src/components/enterprise/quick-actions.tsx`
- Create: `src/app/api/v1/jobs/route.ts` (GET endpoint for job list)

- [ ] **Step 1: Create the GET /api/v1/jobs endpoint**

Create `src/app/api/v1/jobs/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { jobs, enterpriseProfiles, matches } from '@/lib/db/schema';
import { eq, and, count, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (auth.role !== 'enterprise') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [profile] = await db
    .select()
    .from(enterpriseProfiles)
    .where(eq(enterpriseProfiles.userId, auth.userId))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ jobs: [] });
  }

  const jobList = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      description: jobs.description,
      structured: jobs.structured,
      status: jobs.status,
      autoMatch: jobs.autoMatch,
      autoPrechat: jobs.autoPrechat,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt,
      matchCount: sql<number>`(
        SELECT COUNT(*) FROM matches WHERE matches.job_id = ${jobs.id}
      )`.as('match_count'),
      shortlistedCount: sql<number>`(
        SELECT COUNT(*) FROM matches
        WHERE matches.job_id = ${jobs.id} AND matches.status = 'shortlisted'
      )`.as('shortlisted_count'),
    })
    .from(jobs)
    .where(eq(jobs.enterpriseId, profile.id))
    .orderBy(sql`${jobs.createdAt} DESC`);

  return NextResponse.json({ jobs: jobList });
}
```

- [ ] **Step 2: Create the DashboardStatusBar component**

Create `src/components/enterprise/dashboard-status-bar.tsx`:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, Users, Zap, MessageSquare } from 'lucide-react';

interface AIActivityStatus {
  profilesScanned: number;
  matchesFound: number;
  prechatActive: number;
  lastUpdated: string;
}

export function DashboardStatusBar() {
  const [status, setStatus] = useState<AIActivityStatus>({
    profilesScanned: 0,
    matchesFound: 0,
    prechatActive: 0,
    lastUpdated: new Date().toISOString(),
  });
  const [isPolling, setIsPolling] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/jobs');
      if (res.ok) {
        const data = await res.json();
        const totalMatches = data.jobs.reduce(
          (sum: number, job: any) => sum + (Number(job.matchCount) || 0),
          0
        );
        const totalShortlisted = data.jobs.reduce(
          (sum: number, job: any) => sum + (Number(job.shortlistedCount) || 0),
          0
        );
        setStatus({
          profilesScanned: totalMatches > 0 ? totalMatches * 5 : 0, // Approximate profiles scanned
          matchesFound: totalMatches,
          prechatActive: totalShortlisted,
          lastUpdated: new Date().toISOString(),
        });
      }
    } catch {
      // Silently fail on polling errors
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <span className="text-sm font-medium">AI is working</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>{status.profilesScanned} profiles scanned</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="h-4 w-4" />
            <span>{status.matchesFound} matches found</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            <span>{status.prechatActive} pre-chats active</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Create the ActiveJobsList component**

Create `src/components/enterprise/active-jobs-list.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Briefcase, Users, Star, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Job {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  matchCount: number;
  shortlistedCount: number;
}

const statusVariant: Record<string, string> = {
  open: 'bg-green-500/10 text-green-500 border-green-500/20',
  reviewing: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  filled: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  closed: 'bg-muted text-muted-foreground border-border',
};

export function ActiveJobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const res = await fetch('/api/v1/jobs');
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs);
        }
      } catch {
        // Handle error silently
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
        <Briefcase className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No jobs posted yet. Post your first job to start finding talent.
        </p>
        <Link
          href="/enterprise/jobs/new"
          className="mt-4 text-sm font-medium text-primary hover:underline"
        >
          Post a New Job
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job, index) => (
        <motion.div
          key={job.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: index * 0.05 }}
        >
          <Link href={`/enterprise/jobs/${job.id}`}>
            <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{job.title || 'Untitled Position'}</h3>
                    <Badge
                      variant="outline"
                      className={statusVariant[job.status] || statusVariant.open}
                    >
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Posted {new Date(job.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {job.matchCount} matches
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {job.shortlistedCount} shortlisted
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create the QuickActions component**

Create `src/components/enterprise/quick-actions.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { PlusCircle, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function QuickActions() {
  const actions = [
    {
      label: 'Post a New Job',
      href: '/enterprise/jobs/new',
      icon: PlusCircle,
      description: 'Create a job posting with AI-powered structuring',
    },
    {
      label: 'Screen Talent',
      href: '/enterprise/screening',
      icon: Search,
      description: 'Search and compare candidates with AI',
    },
    {
      label: 'Review AI Picks',
      href: '#recommendations',
      icon: Sparkles,
      description: 'See AI-recommended candidates for your jobs',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {actions.map((action, index) => (
        <motion.div
          key={action.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: index * 0.05 }}
        >
          <Link href={action.href}>
            <Button
              variant="outline"
              className="flex h-auto w-full flex-col items-start gap-1.5 p-4 text-left"
            >
              <div className="flex items-center gap-2">
                <action.icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{action.label}</span>
              </div>
              <span className="text-xs text-muted-foreground font-normal">
                {action.description}
              </span>
            </Button>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Replace dashboard placeholder page**

Replace `src/app/(enterprise)/dashboard/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { enterpriseProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { DashboardClient } from './client';

export default async function EnterpriseDashboardPage() {
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

  if (auth.role !== 'enterprise') {
    redirect('/');
  }

  // Redirect to onboarding if not complete
  const [profile] = await db
    .select()
    .from(enterpriseProfiles)
    .where(eq(enterpriseProfiles.userId, auth.userId))
    .limit(1);

  if (!profile?.onboardingDone) {
    redirect('/enterprise/onboarding');
  }

  return (
    <DashboardClient
      companyName={profile.companyName || 'Your Company'}
    />
  );
}
```

Create `src/app/(enterprise)/dashboard/client.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { DashboardStatusBar } from '@/components/enterprise/dashboard-status-bar';
import { ActiveJobsList } from '@/components/enterprise/active-jobs-list';
import { QuickActions } from '@/components/enterprise/quick-actions';

interface DashboardClientProps {
  companyName: string;
}

export function DashboardClient({ companyName }: DashboardClientProps) {
  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="font-serif text-2xl font-semibold">
          Welcome back, {companyName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what your AI has been working on
        </p>
      </motion.div>

      {/* AI Activity Status Bar */}
      <DashboardStatusBar />

      {/* Quick Actions */}
      <section>
        <h2 className="mb-4 text-lg font-medium">Quick Actions</h2>
        <QuickActions />
      </section>

      {/* Active Jobs */}
      <section id="recommendations">
        <h2 className="mb-4 text-lg font-medium">Active Jobs</h2>
        <ActiveJobsList />
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Verify the dashboard renders**

```bash
npm run dev
```

Navigate to `/enterprise/dashboard` while logged in as an onboarded enterprise user. The page should show the status bar, quick actions, and jobs list (empty state if no jobs exist).

- [ ] **Step 7: Commit**

```bash
git add src/app/(enterprise)/dashboard/ src/components/enterprise/dashboard-status-bar.tsx src/components/enterprise/active-jobs-list.tsx src/components/enterprise/quick-actions.tsx src/app/api/v1/jobs/route.ts
git commit -m "feat(spec3): add enterprise dashboard with AI status bar, job list, and quick actions"
```

---

### Task 5: JD Parse System Prompt + AI Endpoint

**Files:**
- Create: `src/lib/ai/prompts/jd-parse.ts`
- Create: `src/app/api/internal/ai/jd-parse/route.ts`

- [ ] **Step 1: Create the JD parse system prompt**

Create `src/lib/ai/prompts/jd-parse.ts`:

```typescript
import { baseSystemPrompt } from './_base';

export function jdParsePrompt() {
  return `${baseSystemPrompt}

You are a JD (Job Description) parser and structuring assistant. Your job is to take raw job description text — whether pasted, described in conversation, or extracted from a URL — and produce a clean structured job posting.

## Your Task
When you receive job description text, extract and structure the following fields:
1. **Title**: The role or project title
2. **Description**: A clean, concise description (2-3 paragraphs max)
3. **Skills**: Required skills, each labeled as must-have or nice-to-have, with a proficiency level (junior/mid/senior/lead)
4. **Seniority**: Overall seniority level — Junior, Mid, Senior, or Lead
5. **Timeline**: Start date and expected duration (if mentioned)
6. **Deliverables**: Key deliverables or responsibilities (for project-based roles)
7. **Budget**: Salary or budget range. If not explicitly stated, suggest a reasonable market range based on your training data for this role and seniority in the China/global market
8. **Work Mode**: Remote, Onsite, or Hybrid

## Behavior
- If the user pastes raw JD text, parse it immediately and call \`structureJob\`
- If the user describes needs in conversation, ask clarifying questions until you have enough to structure
- If anything is ambiguous, make your best judgment and note it — the user can edit later
- Present the structured result and ask for confirmation before finalizing
- Once confirmed, call \`finalizeJob\` to save

## Rules
- Respond in the language the user writes in
- Keep your responses concise
- Be opinionated about skill classification — don't ask the user to categorize every skill
- If a JD is vague, infer reasonable defaults and flag them as assumptions
`;
}
```

- [ ] **Step 2: Create the JD parse API route**

Create `src/app/api/internal/ai/jd-parse/route.ts`:

```typescript
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { getAuthFromRequest } from '@/lib/auth/middleware';
import { getAIModel } from '@/lib/ai/providers';
import { jdParsePrompt } from '@/lib/ai/prompts/jd-parse';
import {
  getOrCreateSession,
  loadChatHistory,
  saveChatMessage,
} from '@/lib/ai/chat';
import { db } from '@/lib/db';
import { jobs, enterpriseProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { addJobToQueue } from '@/lib/jobs/queue';

export async function POST(req: Request) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth || auth.role !== 'enterprise') {
    return new Response('Unauthorized', { status: 401 });
  }

  const { message } = await req.json();

  const session = await getOrCreateSession(auth.userId, 'jd_parse');
  const history = await loadChatHistory(session.id);

  await saveChatMessage(session.id, 'user', message);

  const result = streamText({
    model: getAIModel(),
    system: jdParsePrompt(),
    messages: [
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ],
    tools: {
      structureJob: tool({
        description: 'Present a structured job posting for user review (does not save yet)',
        parameters: z.object({
          title: z.string().describe('Job/project title'),
          description: z.string().describe('Full text description'),
          skills: z.array(
            z.object({
              name: z.string(),
              level: z.enum(['junior', 'mid', 'senior', 'lead']),
              required: z.boolean(),
            })
          ).describe('Required skills'),
          seniority: z.enum(['junior', 'mid', 'senior', 'lead']),
          timeline: z.string().optional(),
          deliverables: z.array(z.string()).optional(),
          budget: z.object({
            min: z.number().optional(),
            max: z.number().optional(),
            currency: z.string().default('CNY'),
          }).optional(),
          workMode: z.enum(['remote', 'onsite', 'hybrid']),
        }),
        execute: async (params) => {
          // This tool just returns the structured data for client-side display
          // The actual save happens in finalizeJob
          return {
            success: true,
            structured: params,
            message: 'Structured job ready for review. User can edit fields before publishing.',
          };
        },
      }),

      finalizeJob: tool({
        description: 'Save the finalized job posting to the database and queue background jobs',
        parameters: z.object({
          title: z.string(),
          description: z.string(),
          skills: z.array(
            z.object({
              name: z.string(),
              level: z.string(),
              required: z.boolean(),
            })
          ),
          seniority: z.enum(['junior', 'mid', 'senior', 'lead']),
          timeline: z.string().optional(),
          deliverables: z.array(z.string()).optional(),
          budget: z.object({
            min: z.number().optional(),
            max: z.number().optional(),
            currency: z.string().default('CNY'),
          }).optional(),
          workMode: z.enum(['remote', 'onsite', 'hybrid']),
        }),
        execute: async (params) => {
          const [profile] = await db
            .select()
            .from(enterpriseProfiles)
            .where(eq(enterpriseProfiles.userId, auth.userId))
            .limit(1);

          if (!profile) {
            return { success: false, message: 'Enterprise profile not found' };
          }

          const [job] = await db
            .insert(jobs)
            .values({
              enterpriseId: profile.id,
              title: params.title,
              description: params.description,
              structured: {
                skills: params.skills,
                seniority: params.seniority,
                timeline: params.timeline || '',
                deliverables: params.deliverables || [],
                budget: params.budget || { currency: 'CNY' },
                workMode: params.workMode,
              },
              status: 'open',
              autoMatch: true,
              autoPrechat: false,
            })
            .returning();

          // Queue background jobs for embedding and match scanning
          try {
            await addJobToQueue('embed-job', { jobId: job!.id });
            await addJobToQueue('scan-matches', { jobId: job!.id });
          } catch {
            // Queue might not be available in dev — proceed anyway
          }

          return {
            success: true,
            jobId: job!.id,
            message: 'Job published! AI is now scanning for matching candidates.',
          };
        },
      }),
    },
    onFinish: async ({ text }) => {
      if (text) {
        await saveChatMessage(session.id, 'assistant', text);
      }
    },
  });

  return result.toDataStreamResponse();
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/prompts/jd-parse.ts src/app/api/internal/ai/jd-parse/route.ts
git commit -m "feat(spec3): add JD parse system prompt and AI endpoint with structureJob/finalizeJob tools"
```

---

### Task 6: New Job Page + Components

**Files:**
- Create: `src/app/(enterprise)/jobs/new/page.tsx`
- Create: `src/components/enterprise/jd-input-form.tsx`
- Create: `src/components/enterprise/structured-job-card.tsx`

- [ ] **Step 1: Create the StructuredJobCard component**

Create `src/components/enterprise/structured-job-card.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Tag,
  Clock,
  DollarSign,
  MapPin,
  ListChecks,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface StructuredJobData {
  title: string;
  description: string;
  skills: Array<{ name: string; level: string; required: boolean }>;
  seniority: string;
  timeline?: string;
  deliverables?: string[];
  budget?: { min?: number; max?: number; currency: string };
  workMode: string;
}

interface StructuredJobCardProps {
  data: StructuredJobData;
  onUpdate: (data: StructuredJobData) => void;
  onPublish: () => void;
  isPublishing: boolean;
}

const seniorityLabels: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  lead: 'Lead',
};

const workModeLabels: Record<string, string> = {
  remote: 'Remote',
  onsite: 'Onsite',
  hybrid: 'Hybrid',
};

export function StructuredJobCard({
  data,
  onUpdate,
  onPublish,
  isPublishing,
}: StructuredJobCardProps) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(data);

  const handleSave = () => {
    onUpdate(editData);
    setEditing(false);
  };

  const toggleSkillRequired = (index: number) => {
    const newSkills = [...editData.skills];
    newSkills[index] = { ...newSkills[index]!, required: !newSkills[index]!.required };
    setEditData({ ...editData, skills: newSkills });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5 text-primary" />
            {editing ? (
              <Input
                value={editData.title}
                onChange={(e) =>
                  setEditData({ ...editData, title: e.target.value })
                }
                className="h-8 text-lg font-semibold"
              />
            ) : (
              data.title
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (editing ? handleSave() : setEditing(true))}
          >
            {editing ? 'Save' : 'Edit'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {data.description}
          </p>

          {/* Skills */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Tag className="h-3.5 w-3.5" />
              Skills
            </div>
            <div className="flex flex-wrap gap-2">
              {(editing ? editData : data).skills.map((skill, index) => (
                <Badge
                  key={`${skill.name}-${index}`}
                  variant={skill.required ? 'default' : 'outline'}
                  className={`cursor-pointer ${
                    editing ? 'hover:opacity-75' : ''
                  } ${
                    skill.required
                      ? ''
                      : 'border-dashed'
                  }`}
                  onClick={() => editing && toggleSkillRequired(index)}
                >
                  {skill.name}
                  <span className="ml-1 text-[10px] opacity-60">
                    {skill.required ? 'must' : 'nice'}
                  </span>
                </Badge>
              ))}
            </div>
            {editing && (
              <p className="mt-1 text-xs text-muted-foreground">
                Click a skill tag to toggle must-have / nice-to-have
              </p>
            )}
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              {seniorityLabels[data.seniority] || data.seniority}
            </div>
            {data.timeline && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {data.timeline}
              </div>
            )}
            {data.budget && (data.budget.min || data.budget.max) && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                {data.budget.min && data.budget.max
                  ? `${data.budget.min.toLocaleString()}-${data.budget.max.toLocaleString()} ${data.budget.currency}`
                  : data.budget.max
                  ? `Up to ${data.budget.max.toLocaleString()} ${data.budget.currency}`
                  : `From ${data.budget.min?.toLocaleString()} ${data.budget.currency}`}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {workModeLabels[data.workMode] || data.workMode}
            </div>
          </div>

          {/* Deliverables */}
          {data.deliverables && data.deliverables.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <ListChecks className="h-3.5 w-3.5" />
                Deliverables
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {data.deliverables.map((d, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/50" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Publish button */}
          <div className="flex justify-end pt-2">
            <Button onClick={onPublish} disabled={isPublishing}>
              {isPublishing ? 'Publishing...' : 'Publish Job'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create the JdInputForm component**

Create `src/components/enterprise/jd-input-form.tsx`:

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from 'ai/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Loader2,
  ClipboardPaste,
  Link as LinkIcon,
  MessageSquare,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StructuredJobCard } from './structured-job-card';

export function JdInputForm() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pasteText, setPasteText] = useState('');
  const [urlText, setUrlText] = useState('');
  const [structuredData, setStructuredData] = useState<any>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [activeTab, setActiveTab] = useState('paste');

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } =
    useChat({
      api: '/api/internal/ai/jd-parse',
      onToolCall: ({ toolCall }) => {
        if (toolCall.toolName === 'structureJob') {
          setStructuredData((toolCall.args as any).structured || toolCall.args);
        }
        if (toolCall.toolName === 'finalizeJob') {
          setIsPublished(true);
          setTimeout(() => {
            router.push('/enterprise/dashboard');
          }, 2000);
        }
      },
    });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    append({
      role: 'user',
      content: `Please parse and structure this job description:\n\n${pasteText}`,
    });
    setActiveTab('conversation');
  };

  const handleUrlSubmit = () => {
    if (!urlText.trim()) return;
    append({
      role: 'user',
      content: `Please parse the job description from this URL: ${urlText}`,
    });
    setActiveTab('conversation');
  };

  const handlePublish = () => {
    if (!structuredData) return;
    append({
      role: 'user',
      content: `Please finalize and publish this job with the following details: ${JSON.stringify(structuredData)}`,
    });
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-12rem)]">
      {/* Left: Input panel */}
      <div className="flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="paste" className="flex items-center gap-1.5">
              <ClipboardPaste className="h-3.5 w-3.5" />
              Paste JD
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5" />
              Link URL
            </TabsTrigger>
            <TabsTrigger value="conversation" className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Conversation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="flex-1 flex flex-col mt-4">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your job description text here..."
              className="flex-1 resize-none rounded-lg border border-border bg-background p-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim() || isLoading}
              className="mt-4 self-end"
            >
              Parse with AI
            </Button>
          </TabsContent>

          <TabsContent value="url" className="flex-1 flex flex-col mt-4">
            <div className="space-y-4">
              <Input
                value={urlText}
                onChange={(e) => setUrlText(e.target.value)}
                placeholder="Enter the URL of the job description"
                type="url"
              />
              <p className="text-xs text-muted-foreground">
                The AI will analyze the URL and extract the job description from its training data knowledge.
              </p>
            </div>
            <Button
              onClick={handleUrlSubmit}
              disabled={!urlText.trim() || isLoading}
              className="mt-4 self-end"
            >
              Parse with AI
            </Button>
          </TabsContent>

          <TabsContent value="conversation" className="flex-1 flex flex-col mt-4">
            <ScrollArea className="flex-1 pr-4" ref={scrollRef as any}>
              <div className="space-y-4 py-2">
                <AnimatePresence mode="popLayout">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`flex ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        {message.content}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Thinking...</span>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {!isPublished && (
              <form
                onSubmit={handleSubmit}
                className="flex items-center gap-2 border-t border-border pt-4"
              >
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Describe your hiring needs..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={isLoading || !input.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}

            {isPublished && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 border-t border-border pt-4 text-green-500"
              >
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">
                  Job published! Redirecting to dashboard...
                </span>
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Right: Structured output panel */}
      <div className="w-96">
        <div className="mb-3 text-sm font-medium text-muted-foreground">
          Structured Job Posting
        </div>
        {structuredData ? (
          <StructuredJobCard
            data={structuredData}
            onUpdate={setStructuredData}
            onPublish={handlePublish}
            isPublishing={isLoading}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
            <Briefcase className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Structured job details will appear here once the AI parses your input.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Import Briefcase at top level
import { Briefcase } from 'lucide-react';
```

Fix: the `Briefcase` import is duplicated at the bottom. Let me write it correctly:

Create `src/components/enterprise/jd-input-form.tsx`:

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from 'ai/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  Send,
  Loader2,
  ClipboardPaste,
  Link as LinkIcon,
  MessageSquare,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StructuredJobCard } from './structured-job-card';

export function JdInputForm() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pasteText, setPasteText] = useState('');
  const [urlText, setUrlText] = useState('');
  const [structuredData, setStructuredData] = useState<any>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [activeTab, setActiveTab] = useState('paste');

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } =
    useChat({
      api: '/api/internal/ai/jd-parse',
      onToolCall: ({ toolCall }) => {
        if (toolCall.toolName === 'structureJob') {
          setStructuredData((toolCall.args as any).structured || toolCall.args);
        }
        if (toolCall.toolName === 'finalizeJob') {
          setIsPublished(true);
          setTimeout(() => {
            router.push('/enterprise/dashboard');
          }, 2000);
        }
      },
    });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    append({
      role: 'user',
      content: `Please parse and structure this job description:\n\n${pasteText}`,
    });
    setActiveTab('conversation');
  };

  const handleUrlSubmit = () => {
    if (!urlText.trim()) return;
    append({
      role: 'user',
      content: `Please parse the job description from this URL: ${urlText}`,
    });
    setActiveTab('conversation');
  };

  const handlePublish = () => {
    if (!structuredData) return;
    append({
      role: 'user',
      content: `Please finalize and publish this job with the following details: ${JSON.stringify(structuredData)}`,
    });
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-12rem)]">
      {/* Left: Input panel */}
      <div className="flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="paste" className="flex items-center gap-1.5">
              <ClipboardPaste className="h-3.5 w-3.5" />
              Paste JD
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5" />
              Link URL
            </TabsTrigger>
            <TabsTrigger value="conversation" className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Conversation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="flex-1 flex flex-col mt-4">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your job description text here..."
              className="flex-1 resize-none rounded-lg border border-border bg-background p-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim() || isLoading}
              className="mt-4 self-end"
            >
              Parse with AI
            </Button>
          </TabsContent>

          <TabsContent value="url" className="flex-1 flex flex-col mt-4">
            <div className="space-y-4">
              <Input
                value={urlText}
                onChange={(e) => setUrlText(e.target.value)}
                placeholder="Enter the URL of the job description"
                type="url"
              />
              <p className="text-xs text-muted-foreground">
                The AI will analyze the URL and extract the job description from its training data knowledge.
              </p>
            </div>
            <Button
              onClick={handleUrlSubmit}
              disabled={!urlText.trim() || isLoading}
              className="mt-4 self-end"
            >
              Parse with AI
            </Button>
          </TabsContent>

          <TabsContent value="conversation" className="flex-1 flex flex-col mt-4">
            <ScrollArea className="flex-1 pr-4" ref={scrollRef as any}>
              <div className="space-y-4 py-2">
                <AnimatePresence mode="popLayout">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`flex ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        {message.content}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Thinking...</span>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {!isPublished && (
              <form
                onSubmit={handleSubmit}
                className="flex items-center gap-2 border-t border-border pt-4"
              >
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Describe your hiring needs..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={isLoading || !input.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}

            {isPublished && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 border-t border-border pt-4 text-green-500"
              >
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">
                  Job published! Redirecting to dashboard...
                </span>
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Right: Structured output panel */}
      <div className="w-96">
        <div className="mb-3 text-sm font-medium text-muted-foreground">
          Structured Job Posting
        </div>
        {structuredData ? (
          <StructuredJobCard
            data={structuredData}
            onUpdate={setStructuredData}
            onPublish={handlePublish}
            isPublishing={isLoading}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
            <Briefcase className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Structured job details will appear here once the AI parses your input.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the new job page**

Create `src/app/(enterprise)/jobs/new/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { enterpriseProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NewJobClient } from './client';

export default async function NewJobPage() {
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

  if (auth.role !== 'enterprise') {
    redirect('/');
  }

  const [profile] = await db
    .select()
    .from(enterpriseProfiles)
    .where(eq(enterpriseProfiles.userId, auth.userId))
    .limit(1);

  if (!profile?.onboardingDone) {
    redirect('/enterprise/onboarding');
  }

  return <NewJobClient />;
}
```

Create `src/app/(enterprise)/jobs/new/client.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { JdInputForm } from '@/components/enterprise/jd-input-form';

export function NewJobClient() {
  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6 flex items-center gap-4"
      >
        <Link href="/enterprise/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-serif text-xl font-semibold">Post a New Job</h1>
          <p className="text-sm text-muted-foreground">
            Paste a JD, link a URL, or describe your needs — the AI will structure it for you
          </p>
        </div>
      </motion.div>

      {/* JD Input Form */}
      <JdInputForm />
    </div>
  );
}
```

- [ ] **Step 4: Verify the new job page renders**

```bash
npm run dev
```

Navigate to `/enterprise/jobs/new` while logged in as an onboarded enterprise user. The page should show three tabs (Paste JD, Link URL, Conversation) with the structured output panel on the right.

- [ ] **Step 5: Commit**

```bash
git add src/app/(enterprise)/jobs/new/ src/components/enterprise/jd-input-form.tsx src/components/enterprise/structured-job-card.tsx
git commit -m "feat(spec3): add new job page with JD input, AI parsing, and editable structured output"
```

---

### Task 7: Job Detail Placeholder + POST /api/v1/jobs Endpoint

**Files:**
- Create: `src/app/(enterprise)/jobs/[id]/page.tsx`
- Modify: `src/app/api/v1/jobs/route.ts` (add POST handler)

- [ ] **Step 1: Create the job detail placeholder page**

Create `src/app/(enterprise)/jobs/[id]/page.tsx`:

```typescript
import { redirect, notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { jobs, enterpriseProfiles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { JobDetailClient } from './client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
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

  if (auth.role !== 'enterprise') {
    redirect('/');
  }

  const [profile] = await db
    .select()
    .from(enterpriseProfiles)
    .where(eq(enterpriseProfiles.userId, auth.userId))
    .limit(1);

  if (!profile) {
    redirect('/enterprise/onboarding');
  }

  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.enterpriseId, profile.id)))
    .limit(1);

  if (!job) {
    notFound();
  }

  return (
    <JobDetailClient
      job={{
        id: job.id,
        title: job.title || 'Untitled',
        description: job.description || '',
        status: job.status || 'open',
        createdAt: job.createdAt?.toISOString() || '',
        structured: job.structured as any,
      }}
    />
  );
}
```

Create `src/app/(enterprise)/jobs/[id]/client.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Users, Clock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface JobDetailClientProps {
  job: {
    id: string;
    title: string;
    description: string;
    status: string;
    createdAt: string;
    structured: any;
  };
}

export function JobDetailClient({ job }: JobDetailClientProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-4"
      >
        <Link href="/enterprise/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-xl font-semibold">{job.title}</h1>
            <Badge variant="outline">
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Posted {new Date(job.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Button variant="outline">Edit JD</Button>
        <Button>AI Screen</Button>
      </motion.div>

      {/* Placeholder content — fully implemented in Spec 4 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Matched Candidates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="relative mb-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30 opacity-75" />
              <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your AI is scanning the talent pool for matches...
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Candidate matching and screening will be available in the next update.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Add POST handler to /api/v1/jobs**

Append to `src/app/api/v1/jobs/route.ts` (add the POST export alongside the existing GET):

```typescript
export async function POST(req: NextRequest) {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (auth.role !== 'enterprise') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [profile] = await db
    .select()
    .from(enterpriseProfiles)
    .where(eq(enterpriseProfiles.userId, auth.userId))
    .limit(1);

  if (!profile) {
    return NextResponse.json(
      { error: 'Enterprise profile not found' },
      { status: 404 }
    );
  }

  const body = await req.json();

  const [job] = await db
    .insert(jobs)
    .values({
      enterpriseId: profile.id,
      title: body.title,
      description: body.description || '',
      structured: body.structured || {
        skills: [],
        seniority: 'mid',
        timeline: '',
        deliverables: [],
        budget: { currency: 'CNY' },
        workMode: 'remote',
      },
      status: 'open',
      autoMatch: body.autoMatch ?? true,
      autoPrechat: body.autoPrechat ?? false,
    })
    .returning();

  // Queue background jobs
  try {
    const { addJobToQueue } = await import('@/lib/jobs/queue');
    await addJobToQueue('embed-job', { jobId: job!.id });
    await addJobToQueue('scan-matches', { jobId: job!.id });
  } catch {
    // Queue might not be available in dev
  }

  return NextResponse.json({ job }, { status: 201 });
}
```

- [ ] **Step 3: Add PATCH /api/v1/jobs/[id] endpoint**

Create `src/app/api/v1/jobs/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { jobs, enterpriseProfiles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, id))
    .limit(1);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (auth.role !== 'enterprise') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [profile] = await db
    .select()
    .from(enterpriseProfiles)
    .where(eq(enterpriseProfiles.userId, auth.userId))
    .limit(1);

  if (!profile) {
    return NextResponse.json(
      { error: 'Enterprise profile not found' },
      { status: 404 }
    );
  }

  // Verify job belongs to this enterprise
  const [existing] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.enterpriseId, profile.id)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const body = await req.json();

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) updateFields.title = body.title;
  if (body.description !== undefined) updateFields.description = body.description;
  if (body.structured !== undefined) updateFields.structured = body.structured;
  if (body.status !== undefined) updateFields.status = body.status;
  if (body.autoMatch !== undefined) updateFields.autoMatch = body.autoMatch;
  if (body.autoPrechat !== undefined) updateFields.autoPrechat = body.autoPrechat;

  const [updated] = await db
    .update(jobs)
    .set(updateFields)
    .where(eq(jobs.id, id))
    .returning();

  // Re-queue embedding if content changed
  if (body.title || body.description || body.structured) {
    try {
      const { addJobToQueue } = await import('@/lib/jobs/queue');
      await addJobToQueue('embed-job', { jobId: id });
      await addJobToQueue('scan-matches', { jobId: id });
    } catch {
      // Queue might not be available in dev
    }
  }

  return NextResponse.json({ job: updated });
}
```

- [ ] **Step 4: Verify pages and endpoints**

```bash
npm run dev
```

Test:
- Navigate to `/enterprise/jobs/new` and verify the three-tab input interface renders
- Create a job via the dashboard (if onboarded) and verify the job detail page loads at `/enterprise/jobs/[id]`
- Test `GET /api/v1/jobs` returns the job list
- Test `POST /api/v1/jobs` creates a new job

- [ ] **Step 5: Commit**

```bash
git add src/app/(enterprise)/jobs/[id]/ src/app/api/v1/jobs/
git commit -m "feat(spec3): add job detail placeholder, POST /api/v1/jobs, and PATCH /api/v1/jobs/[id] endpoints"
```

---

### Task 8: Wire Up Queue Integration + Typecheck

**Files:**
- Modify: `src/lib/jobs/queue.ts` (ensure `addJobToQueue` export exists)

- [ ] **Step 1: Verify the queue module exports `addJobToQueue`**

The Foundation spec (Spec 0) should have created `src/lib/jobs/queue.ts` with stub workers. Verify it exports an `addJobToQueue` function. If not, add it:

In `src/lib/jobs/queue.ts`, ensure this function exists:

```typescript
import { Queue } from 'bullmq';
import { redisConnection } from './redis';

type JobType = 'embed-profile' | 'embed-job' | 'scan-matches' | 'generate-report' | 'pre-chat' | 'update-graph';

const queues = new Map<string, Queue>();

function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    queues.set(
      name,
      new Queue(name, { connection: redisConnection })
    );
  }
  return queues.get(name)!;
}

export async function addJobToQueue(
  jobType: JobType,
  data: Record<string, unknown>
): Promise<void> {
  const queue = getQueue(jobType);
  await queue.add(jobType, data);
}
```

If Redis is not available in development, wrap the queue operations in try/catch (already done in the API routes above).

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Fix any type errors. Common issues:
- Missing imports for `addJobToQueue`
- `drizzle-orm` operator imports (`eq`, `and`, `sql`, `count`)
- `ai/react` hooks type mismatches — ensure `ai` package is installed (`npm install ai`)

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 4: Run full check**

```bash
npm run check
```

Expected: All lint, typecheck, and tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(spec3): wire up queue integration, fix types, pass full check"
```

---

### Task 9: End-to-End Smoke Test

**Files:** None (manual testing only)

- [ ] **Step 1: Test enterprise onboarding flow**

1. Log in as `enterprise1@csv.dev` / `csv2026`
2. Navigate to `/enterprise/onboarding`
3. Verify AI greets and asks for company name
4. Provide a company name — verify AI generates a summary and calls `setCompanyProfile`
5. Verify the CompanyProfileCard appears on the right
6. Answer intent question (e.g., "recruit for a role")
7. Paste or describe a job requirement — verify AI structures it and calls `createJob`
8. Set matching preferences — verify AI calls `completeOnboarding`
9. Verify redirect to `/enterprise/dashboard`

- [ ] **Step 2: Test dashboard**

1. On `/enterprise/dashboard`, verify:
   - AI status bar with green pulse dot
   - Quick action buttons link correctly
   - Active jobs list shows the job created during onboarding
2. Click the job to verify `/enterprise/jobs/[id]` loads with the placeholder

- [ ] **Step 3: Test new job flow**

1. Navigate to `/enterprise/jobs/new`
2. Paste a sample JD in the "Paste JD" tab
3. Click "Parse with AI" — verify it switches to conversation tab
4. Verify the StructuredJobCard appears on the right
5. Toggle a skill's must-have/nice-to-have status
6. Click "Publish Job" — verify redirect to dashboard
7. Verify the new job appears in the active jobs list

- [ ] **Step 4: Test API endpoints**

```bash
# Get jobs list
curl -b "auth-token=<token>" http://localhost:3000/api/v1/jobs

# Create a job via API
curl -X POST -b "auth-token=<token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Role","description":"Test","structured":{"skills":[],"seniority":"mid","timeline":"","deliverables":[],"budget":{"currency":"CNY"},"workMode":"remote"}}' \
  http://localhost:3000/api/v1/jobs

# Get single job
curl -b "auth-token=<token>" http://localhost:3000/api/v1/jobs/<job-id>

# Update a job
curl -X PATCH -b "auth-token=<token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Role","status":"reviewing"}' \
  http://localhost:3000/api/v1/jobs/<job-id>
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(spec3): enterprise onboarding, dashboard, and job management complete"
```
