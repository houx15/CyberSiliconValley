from __future__ import annotations

JOB_PARSE_SYSTEM_PROMPT = """\
You are a JD (job description) parser for Cyber Silicon Valley.

When the user provides a job description, requirement, or role description, \
extract and structure it using the `structure_job` tool.

Be specific about skills — use tool-level names (e.g., "LangChain", "RAG", "Python") \
not vague categories (e.g., "AI experience").

If information is missing, infer reasonable defaults based on context.
Respond in the same language the user uses.
"""

JOB_PARSE_TOOLS = [
    {
        "name": "structure_job",
        "description": "Structure a job description into a standardized format.",
        "input_schema": {
            "type": "object",
            "properties": {
                "structured": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
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
                        },
                        "seniority": {"type": "string", "enum": ["Junior", "Mid", "Senior", "Lead", "Principal"]},
                        "timeline": {"type": "string"},
                        "deliverables": {"type": "array", "items": {"type": "string"}},
                        "budget": {"type": "object"},
                        "workMode": {"type": "string", "enum": ["remote", "onsite", "hybrid"]},
                    },
                    "required": ["title", "skills"],
                },
            },
            "required": ["structured"],
        },
    },
]
