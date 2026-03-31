from __future__ import annotations

from core.seed.service import SeedService
from db.session import create_engine_from_url, create_session_factory


def run_seed_command(*, reset: bool = False) -> int:
    engine = create_engine_from_url()
    session_factory = create_session_factory(engine)
    service = SeedService(engine=engine, session_factory=session_factory)
    try:
        summary = service.run(reset=reset)
    finally:
        engine.dispose()

    print(
        "Seed complete:",
        {
            "users": summary.users,
            "talent_profiles": summary.talent_profiles,
            "enterprise_profiles": summary.enterprise_profiles,
            "jobs": summary.jobs,
            "matches": summary.matches,
            "keyword_nodes": summary.keyword_nodes,
            "keyword_edges": summary.keyword_edges,
            "inbox_items": summary.inbox_items,
            "seeking_reports": summary.seeking_reports,
        },
    )
    return 0
