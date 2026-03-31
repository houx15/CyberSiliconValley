'use client';

import { useState, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { AwakeningScreen } from '@/components/onboarding/awakening-screen';
import { EntryPaths } from '@/components/onboarding/entry-paths';
import { ConversationPanel } from '@/components/onboarding/conversation-panel';
import { ProfileReveal } from '@/components/onboarding/profile-reveal';
import { GuidedTour } from '@/components/onboarding/guided-tour';
import type { Skill, Experience } from '@/types';

type OnboardingScreen = 'awakening' | 'entry' | 'conversation' | 'tour';

interface ProfileData {
  displayName?: string;
  headline?: string;
  bio?: string;
  skills: Skill[];
  experience: Experience[];
  goals?: {
    targetRoles?: string[];
    workPreferences?: string[];
    interests?: string[];
  };
}

export default function OnboardingPage() {
  const [screen, setScreen] = useState<OnboardingScreen>('awakening');
  const [profileData, setProfileData] = useState<ProfileData>({
    skills: [],
    experience: [],
  });
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());

  const handleRevealField = useCallback((field: string, value: unknown) => {
    setRevealedFields((prev) => new Set([...prev, field]));
    setProfileData((prev) => {
      if (field === 'displayName' || field === 'headline' || field === 'bio') {
        return { ...prev, [field]: value as string };
      }
      if (field === 'experience') {
        return { ...prev, experience: [...prev.experience, value as Experience] };
      }
      if (field === 'goals') {
        return { ...prev, goals: { ...prev.goals, ...(value as Record<string, unknown>) } };
      }
      return prev;
    });
  }, []);

  const handleAddSkill = useCallback((skill: Skill) => {
    setRevealedFields((prev) => new Set([...prev, 'skills']));
    setProfileData((prev) => {
      if (prev.skills.some((s) => s.name.toLowerCase() === skill.name.toLowerCase())) {
        return prev;
      }
      return { ...prev, skills: [...prev.skills, skill] };
    });
  }, []);

  const handleComplete = useCallback(() => {
    setScreen('tour');
  }, []);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/internal/ai/onboarding',
    }),
    onToolCall({ toolCall }) {
      const tc = toolCall as { toolName: string; input: Record<string, unknown> };
      if (tc.toolName === 'revealProfileField') {
        handleRevealField(tc.input.field as string, tc.input.value);
      } else if (tc.toolName === 'addSkillTag') {
        handleAddSkill({
          name: tc.input.name as string,
          level: tc.input.level as Skill['level'],
          category: tc.input.category as string,
        });
      } else if (tc.toolName === 'completeOnboarding') {
        handleComplete();
      }
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  const handleAwakeningComplete = useCallback(() => {
    setScreen('entry');
  }, []);

  const handleEntrySelect = useCallback(
    (path: string) => {
      setScreen('conversation');
      const messageMap: Record<string, string> = {
        conversation: "Hi! I'd like to tell you about myself.",
        resume: "I'd like to upload my resume to get started.",
        link: "I have a personal page I'd like to share.",
        voice: "I'd like to introduce myself by voice.",
      };
      const text = messageMap[path] ?? messageMap['conversation']!;
      sendMessage({ text });
    },
    [sendMessage]
  );

  const handleTourComplete = useCallback(() => {
    window.location.href = '/talent/home';
  }, []);

  if (screen === 'awakening') {
    return <AwakeningScreen onComplete={handleAwakeningComplete} />;
  }

  if (screen === 'entry') {
    return <EntryPaths onSelect={handleEntrySelect} />;
  }

  if (screen === 'tour') {
    return <GuidedTour onComplete={handleTourComplete} />;
  }

  // Conversation screen: split layout
  return (
    <div className="flex h-screen">
      <div className="w-1/2 h-full border-r border-border">
        <ConversationPanel
          messages={messages}
          isLoading={isLoading}
          onSendMessage={(text: string) => sendMessage({ text })}
        />
      </div>
      <div className="w-1/2 h-full overflow-auto">
        <ProfileReveal
          profileData={profileData}
          revealedFields={revealedFields}
        />
      </div>
    </div>
  );
}
