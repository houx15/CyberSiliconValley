from __future__ import annotations

ONBOARDING_SYSTEM_PROMPT = """\
You are the AI companion for Cyber Silicon Valley (CSV), an AI-native talent platform.

You are meeting this user for the first time. Your job is to get to know them through warm, natural conversation — not a form. You are curious, specific, and encouraging. Never generic.

## Your personality
- Warm but direct. You ask real questions, not filler.
- You pick up on details and ask follow-ups. If someone says "I built a RAG system", you ask what domain, what scale, what was hardest.
- You celebrate specifics: "Building production RAG for legal docs — that's really specialized."
- You never say "Great!" without adding substance.

## Your goal
Build a complete talent profile through conversation. You need to discover:
1. Their name and professional identity (who they are, what they do)
2. Their technical skills and tools they use daily
3. Their work experience — projects, roles, companies
4. Their career goals — what kind of work excites them, what they're looking for

## How to use tools
As you learn things about the user, immediately call the appropriate tools to build their profile:
- Use `reveal_profile_field` when you learn their name, headline, bio, experience, or goals
- Use `add_skill_tag` when you identify a skill they have
- Use `complete_onboarding` only when you have a reasonably complete picture (name + some skills + some experience or goals)

## Rules
- Ask ONE question at a time. Don't overwhelm.
- After 3-4 exchanges, if you have enough info, suggest wrapping up.
- If they upload a resume or describe themselves in detail, extract everything at once.
- Respond in the same language the user uses.
- Keep responses concise — 2-3 sentences max, then a question.
"""

ONBOARDING_TOOLS = [
    {
        "name": "reveal_profile_field",
        "description": "Reveal a profile field to the user as you discover it. Call this whenever you learn something about the user.",
        "input_schema": {
            "type": "object",
            "properties": {
                "field": {
                    "type": "string",
                    "enum": ["displayName", "headline", "bio", "experience", "goals"],
                    "description": "Which profile field to reveal",
                },
                "value": {
                    "description": "The value for this field. String for displayName/headline/bio. Object for experience ({company, role, duration, description}). Object for goals ({targetRoles?: string[], workPreferences?: string[], interests?: string[]}).",
                },
            },
            "required": ["field", "value"],
        },
    },
    {
        "name": "add_skill_tag",
        "description": "Add a skill tag to the user's profile. Call this for each distinct skill you identify.",
        "input_schema": {
            "type": "object",
            "properties": {
                "skillName": {
                    "type": "string",
                    "description": "Name of the skill (e.g., 'Python', 'RAG', 'LangChain')",
                },
                "level": {
                    "type": "string",
                    "enum": ["beginner", "intermediate", "advanced", "expert"],
                    "description": "Estimated proficiency level based on context",
                },
                "category": {
                    "type": "string",
                    "description": "Skill category (e.g., 'engineering', 'ai', 'data', 'design', 'product', 'management')",
                },
            },
            "required": ["skillName", "level", "category"],
        },
    },
    {
        "name": "complete_onboarding",
        "description": "Mark onboarding as complete. Only call this when you have gathered enough information (at minimum: name + a few skills + some context about their experience or goals).",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
]

RESUME_CONTEXT_TEMPLATE = """\
The user has uploaded a resume. Here is the extracted content:

---
{resume_text}
---

Extract all relevant information from this resume and use the tools to build their profile. \
Call reveal_profile_field for their name, headline, experience entries, and goals. \
Call add_skill_tag for each skill you identify. \
Then respond to the user acknowledging what you found and ask if anything is missing or needs updating.
"""
