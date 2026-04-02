from __future__ import annotations

ENTERPRISE_ONBOARDING_SYSTEM_PROMPT = """\
You are the AI assistant for Cyber Silicon Valley (CSV), helping enterprises set up their hiring presence.

## Your goal
Get the company set up quickly and naturally through conversation. You need to:
1. Identify the company — name, website, industry, size
2. Understand what they need — what roles/talent they're looking for
3. Optionally create their first job posting

## Your approach
- When the user provides a company name or website, use `set_company_profile` to register it
- When they describe a role they need to fill, use `create_job` to draft it
- When setup feels complete (company profile + at least one job or clear intent), use `complete_onboarding`

## Personality
- Professional but warm. You're a helpful recruiting partner, not a form.
- Ask clarifying questions about vague requirements: "You mentioned AI experience — do you need someone who builds ML models, or someone who integrates LLM APIs?"
- Be specific about what you captured.

## Rules
- Respond in the same language the user uses.
- Keep responses concise — 2-3 sentences, then a question.
- If you can infer industry/size from context, do so. Don't ask obvious questions.
- After creating a company profile, immediately ask about their first hiring need.
"""

ENTERPRISE_ONBOARDING_TOOLS = [
    {
        "name": "set_company_profile",
        "description": "Set or update the enterprise company profile. Call this when you learn about the company.",
        "input_schema": {
            "type": "object",
            "properties": {
                "companyName": {"type": "string", "description": "Company name"},
                "industry": {"type": "string", "description": "Industry/sector"},
                "companySize": {
                    "type": "string",
                    "enum": ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
                    "description": "Employee count range",
                },
                "website": {"type": "string", "description": "Company website URL"},
                "description": {"type": "string", "description": "Brief company description"},
                "aiMaturity": {
                    "type": "string",
                    "enum": ["exploring", "growing", "established", "leading"],
                    "description": "AI adoption maturity level",
                },
            },
            "required": ["companyName"],
        },
    },
    {
        "name": "create_job",
        "description": "Create a job posting draft based on what the enterprise described.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Job title"},
                "description": {"type": "string", "description": "Role description"},
                "skills": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "level": {"type": "string", "enum": ["beginner", "intermediate", "advanced", "expert"]},
                            "required": {"type": "boolean"},
                        },
                        "required": ["name"],
                    },
                    "description": "Required and nice-to-have skills",
                },
                "seniority": {"type": "string", "enum": ["Junior", "Mid", "Senior", "Lead", "Principal"]},
                "workMode": {"type": "string", "enum": ["remote", "onsite", "hybrid"]},
            },
            "required": ["title"],
        },
    },
    {
        "name": "complete_onboarding",
        "description": "Mark enterprise onboarding as complete. Call this when the company profile is set and they have at least one job or clear next steps.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
]
