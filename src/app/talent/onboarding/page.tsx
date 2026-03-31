'use client';

import { useState, useCallback } from 'react';
import { AwakeningScreen } from '@/components/onboarding/awakening-screen';
import { EntryPaths } from '@/components/onboarding/entry-paths';
import { ConversationPanel } from '@/components/onboarding/conversation-panel';
import { ProfileReveal } from '@/components/onboarding/profile-reveal';
import { GuidedTour } from '@/components/onboarding/guided-tour';
import type { Skill, Experience } from '@/types';
import { postSseJson } from '@/lib/api/sse';

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

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: Array<{ type: 'text'; text: string }>;
};

export default function OnboardingPage() {
  const [screen, setScreen] = useState<OnboardingScreen>('awakening');
  const [profileData, setProfileData] = useState<ProfileData>({
    skills: [],
    experience: [],
  });
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  const sendMessage = useCallback(
    async (text: string) => {
      const messageText = text.trim();
      if (!messageText || isLoading) {
        return;
      }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        parts: [{ type: 'text', text: messageText }],
      };
      const assistantId = `assistant-${Date.now()}`;

      setMessages((prev) => [...prev, userMessage, { id: assistantId, role: 'assistant', parts: [] }]);
      setIsLoading(true);

      try {
        await postSseJson(
          '/api/v1/onboarding/chat',
          { message: messageText },
          {
            onEvent: (event) => {
              if (event.event === 'tool') {
                if (event.data.name === 'reveal_profile_field') {
                  handleRevealField(String(event.data.field ?? ''), event.data.value);
                } else if (event.data.name === 'add_skill_tag') {
                  handleAddSkill({
                    name: String(event.data.skillName ?? 'Skill'),
                    level: String(event.data.level ?? 'intermediate') as Skill['level'],
                    category: String(event.data.category ?? 'general'),
                  });
                } else if (event.data.name === 'complete_onboarding') {
                  handleComplete();
                }
              }

              if (event.event === 'text') {
                const delta = String(event.data.delta ?? '');
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === assistantId
                      ? {
                          ...message,
                          parts: [{ type: 'text', text: `${message.parts[0]?.text ?? ''}${delta}` }],
                        }
                      : message
                  )
                );
              }

              if (event.event === 'done') {
                const finalMessage = String(event.data.message ?? '');
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === assistantId
                      ? {
                          ...message,
                          parts: [{ type: 'text', text: finalMessage || message.parts[0]?.text || '' }],
                        }
                      : message
                  )
                );
                setIsLoading(false);
              }
            },
          }
        );
      } catch (error) {
        const errorText = error instanceof Error ? error.message : 'Unable to continue onboarding right now.';
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId ? { ...message, parts: [{ type: 'text', text: errorText }] } : message
          )
        );
        setIsLoading(false);
      }
    },
    [handleAddSkill, handleComplete, handleRevealField, isLoading]
  );

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
      void sendMessage(text);
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
          onSendMessage={(text: string) => {
            void sendMessage(text);
          }}
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
