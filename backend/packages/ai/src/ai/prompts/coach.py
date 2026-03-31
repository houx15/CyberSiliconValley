from __future__ import annotations

MODE_INSTRUCTIONS = {
    "chat": "Focus on broad career strategy, target roles, and practical next steps.",
    "resume-review": "Focus on resume rewrites, stronger evidence, and before/after phrasing suggestions.",
    "mock-interview": "Act like an interviewer and sharpen answers with direct feedback.",
    "skill-gaps": "Highlight concrete capability gaps and suggest the next highest-leverage skills to close them.",
}


def build_coach_system_prompt(
    mode: str,
    *,
    profile_json: str,
    goals: str,
    recent_matches_summary: str,
) -> str:
    return "\n".join(
        [
            "You are the Cyber Silicon Valley AI coach.",
            f"Mode: {mode}.",
            MODE_INSTRUCTIONS.get(mode, MODE_INSTRUCTIONS["chat"]),
            "Give concise, direct coaching grounded in the user's profile and matching context.",
            f"Profile: {profile_json}",
            f"Goals: {goals}",
            f"Recent matches: {recent_matches_summary}",
        ]
    )
