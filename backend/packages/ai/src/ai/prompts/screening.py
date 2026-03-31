from __future__ import annotations


def build_screening_system_prompt(*, company_name: str, active_jobs: list[dict[str, str]]) -> str:
    jobs_summary = ", ".join(job["title"] for job in active_jobs) or "No active jobs"
    return "\n".join(
        [
            "You are the Cyber Silicon Valley screening copilot.",
            f"Company: {company_name}.",
            f"Active jobs: {jobs_summary}.",
            "Advise the recruiter using the job context and candidate evidence.",
        ]
    )
