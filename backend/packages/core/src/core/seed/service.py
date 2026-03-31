from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from itertools import combinations
from typing import Any
from uuid import UUID

import bcrypt
from sqlalchemy import delete, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from contracts.seeking import (
    HighMatchItem,
    InboundInterestItem,
    PreChatItem,
    ScanSummary,
    SeekingReportData,
    SkillMatch,
)
from core.seed.fixtures import (
    DEFAULT_PASSWORD,
    ENTERPRISE_FIXTURES,
    FAMILY_NAMES,
    GIVEN_NAMES,
    SKILL_CATALOG,
    SYSTEM_MESSAGES,
    TALENT_BATCHES,
)
from db.base import Base
from db.models.enterprise_profile import EnterpriseProfile
from db.models.inbox_item import InboxItem
from db.models.job import Job
from db.models.keyword_edge import KeywordEdge
from db.models.keyword_node import KeywordNode
from db.models.match import Match
from db.models.seeking_report import SeekingReport
from db.models.talent_profile import TalentProfile
from db.models.user import User
from db.session import session_scope


DEMO_TALENT_EMAILS = ["talent1@csv.dev", "talent2@csv.dev", "talent3@csv.dev"]
DEMO_ENTERPRISE_EMAILS = ["enterprise1@csv.dev", "enterprise2@csv.dev"]

AVAILABILITY_SEQUENCE = ["open", "open", "busy", "open", "not_looking"]
WORK_MODES = ["remote", "hybrid", "onsite"]
LOCATIONS = ["Shanghai", "Beijing", "Shenzhen", "Hangzhou", "Remote"]
SENIORITY_SEQUENCE = ["senior", "mid", "staff", "mid", "junior"]


@dataclass(frozen=True, slots=True)
class SeedSummary:
    users: int
    talent_profiles: int
    enterprise_profiles: int
    jobs: int
    matches: int
    keyword_nodes: int
    keyword_edges: int
    inbox_items: int
    seeking_reports: int


@dataclass(slots=True)
class SeedService:
    engine: Engine
    session_factory: sessionmaker[Session]

    def run(self, *, reset: bool = False) -> SeedSummary:
        if reset:
            self.reset_database()

        with session_scope(self.session_factory) as session:
            password_hash = bcrypt.hashpw(DEFAULT_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            talent_profiles = self._seed_talent_profiles(session, password_hash)
            enterprise_profiles = self._seed_enterprise_profiles(session, password_hash)
            jobs = self._seed_jobs(session, enterprise_profiles)
            matches = self._seed_matches(session, talent_profiles, jobs)
            self._ensure_demo_high_matches(session)
            keyword_nodes, keyword_edges = self._seed_keyword_graph(session, jobs)
            inbox_items = self._seed_inbox_items(session, jobs)
            reports = self._seed_seeking_reports(session, jobs)
            users = session.execute(select(User)).scalars().all()

        return SeedSummary(
            users=len(users),
            talent_profiles=len(talent_profiles),
            enterprise_profiles=len(enterprise_profiles),
            jobs=len(jobs),
            matches=len(matches),
            keyword_nodes=len(keyword_nodes),
            keyword_edges=len(keyword_edges),
            inbox_items=len(inbox_items),
            seeking_reports=len(reports),
        )

    def reset_database(self) -> None:
        Base.metadata.drop_all(self.engine, checkfirst=True)
        Base.metadata.create_all(self.engine, checkfirst=True)

    def _seed_talent_profiles(self, session: Session, password_hash: str) -> list[TalentProfile]:
        profiles: list[TalentProfile] = []
        global_index = 0

        for batch in TALENT_BATCHES:
            for local_index in range(batch.count):
                email = (
                    DEMO_TALENT_EMAILS[global_index]
                    if global_index < len(DEMO_TALENT_EMAILS)
                    else f"talent-seed-{global_index - len(DEMO_TALENT_EMAILS) + 1}@csv.dev"
                )
                user = self._get_or_create_user(session, email=email, role="talent", password_hash=password_hash)
                name = self._unique_name(global_index)
                skill_names = self._skill_bundle(batch.category, global_index)
                profile = self._get_or_create_talent_profile(
                    session,
                    user=user,
                    values={
                        "display_name": name,
                        "headline": self._talent_headline(batch.category, global_index),
                        "bio": self._talent_bio(name, batch.category, global_index),
                        "skills": self._skill_entries(skill_names, batch.category),
                        "experience": self._experience_entries(batch.category, global_index),
                        "education": self._education_entries(global_index),
                        "goals": self._goals(batch.category, global_index),
                        "availability": AVAILABILITY_SEQUENCE[global_index % len(AVAILABILITY_SEQUENCE)],
                        "salary_range": {"min": 30 + global_index, "max": 55 + global_index, "currency": "CNYk/month"},
                        "resume_url": None,
                        "profile_data": {
                            "seedCategory": batch.category,
                            "focusSkills": skill_names[:4],
                            "yearsOfExperience": 2 + (global_index % 9),
                        },
                        "onboarding_done": True,
                    },
                )
                profiles.append(profile)
                global_index += 1

        return profiles

    def _seed_enterprise_profiles(self, session: Session, password_hash: str) -> list[EnterpriseProfile]:
        profiles: list[EnterpriseProfile] = []

        for index, fixture in enumerate(ENTERPRISE_FIXTURES):
            email = (
                DEMO_ENTERPRISE_EMAILS[index]
                if index < len(DEMO_ENTERPRISE_EMAILS)
                else f"enterprise-seed-{index - len(DEMO_ENTERPRISE_EMAILS) + 1}@csv.dev"
            )
            user = self._get_or_create_user(session, email=email, role="enterprise", password_hash=password_hash)
            company_name = str(fixture["company_name"])
            profile = self._get_or_create_enterprise_profile(
                session,
                user=user,
                values={
                    "company_name": company_name,
                    "industry": fixture["industry"],
                    "company_size": fixture["company_size"],
                    "website": self._company_website(company_name),
                    "description": self._enterprise_description(company_name, str(fixture["focus"])),
                    "ai_maturity": fixture["ai_maturity"],
                    "profile_data": {
                        "focusCategory": fixture["focus"],
                        "hiringTheme": f"{fixture['industry']} teams shipping production AI",
                    },
                    "preferences": {
                        "focusCategory": fixture["focus"],
                        "autoMatch": True,
                        "autoPrechat": index % 3 == 0,
                    },
                    "onboarding_done": True,
                },
            )
            profiles.append(profile)

        return profiles

    def _seed_jobs(self, session: Session, enterprises: list[EnterpriseProfile]) -> list[Job]:
        jobs: list[Job] = []

        for enterprise_index, enterprise in enumerate(enterprises):
            focus = str((enterprise.profile_data or {}).get("focusCategory") or "AI Agent/Framework")
            focus_skills = SKILL_CATALOG[focus]
            for offset in range(2):
                skill_slice = [focus_skills[(offset + shift) % len(focus_skills)] for shift in range(4)]
                title = self._job_title(focus, offset)
                description = self._job_description(enterprise.company_name or "Enterprise", focus, offset)
                structured = {
                    "skills": self._job_skills(skill_slice),
                    "seniority": SENIORITY_SEQUENCE[(enterprise_index + offset) % len(SENIORITY_SEQUENCE)],
                    "timeline": "Immediate start" if offset == 0 else "Next quarter",
                    "deliverables": self._deliverables(focus, offset),
                    "budget": {
                        "min": 45 + enterprise_index * 2 + offset * 5,
                        "max": 70 + enterprise_index * 2 + offset * 8,
                        "currency": "CNYk/month",
                    },
                    "workMode": WORK_MODES[(enterprise_index + offset) % len(WORK_MODES)],
                    "location": LOCATIONS[(enterprise_index + offset) % len(LOCATIONS)],
                    "focusCategory": focus,
                }
                job = self._get_or_create_job(
                    session,
                    enterprise=enterprise,
                    title=title,
                    description=description,
                    structured=structured,
                    auto_prechat=bool((enterprise.preferences or {}).get("autoPrechat", False)),
                )
                jobs.append(job)

        return jobs

    def _seed_matches(self, session: Session, talents: list[TalentProfile], jobs: list[Job]) -> list[Match]:
        matches: list[Match] = []

        for job in jobs:
            required_skills = {str(skill["name"]) for skill in (job.structured or {}).get("skills", [])}
            focus = str((job.structured or {}).get("focusCategory") or "")
            for talent in talents:
                talent_skills = {str(skill["name"]) for skill in (talent.skills or [])}
                overlap = len(required_skills & talent_skills)
                if overlap < 2:
                    continue

                same_category = (talent.profile_data or {}).get("seedCategory") == focus
                availability = talent.availability or "open"
                score = 52 + overlap * 10 + (10 if same_category else 0)
                if availability == "open":
                    score += 4
                elif availability == "busy":
                    score += 1
                score = float(min(score, 96))

                breakdown = {
                    "skillOverlap": round(overlap / max(len(required_skills), 1), 2),
                    "categoryAlignment": 1.0 if same_category else 0.55,
                    "availability": 1.0 if availability == "open" else 0.75 if availability == "busy" else 0.4,
                }
                reasoning = (
                    f"{talent.display_name or 'Candidate'} matches {job.title} through {overlap} shared skills "
                    f"and {'strong' if same_category else 'partial'} domain alignment."
                )
                match = self._get_or_create_match(
                    session,
                    job=job,
                    talent=talent,
                    score=score,
                    breakdown=breakdown,
                    ai_reasoning=reasoning,
                )
                matches.append(match)

        return matches

    def _ensure_demo_high_matches(self, session: Session) -> None:
        for email in DEMO_TALENT_EMAILS:
            profile = session.execute(
                select(TalentProfile)
                .join(User, TalentProfile.user_id == User.id)
                .where(User.email == email)
            ).scalar_one()
            top_matches = session.execute(
                select(Match)
                .where(Match.talent_id == profile.id)
                .order_by(Match.score.desc())
                .limit(3)
            ).scalars().all()
            for index, match in enumerate(top_matches):
                match.score = float(max(match.score, 82 + index * 3))

    def _seed_keyword_graph(self, session: Session, jobs: list[Job]) -> tuple[list[KeywordNode], list[KeywordEdge]]:
        session.execute(delete(KeywordEdge))
        session.execute(delete(KeywordNode))
        session.flush()

        keyword_counts: Counter[str] = Counter()
        edge_counts: Counter[tuple[str, str]] = Counter()
        for job in jobs:
            skill_names = [str(skill["name"]) for skill in (job.structured or {}).get("skills", [])]
            keyword_counts.update(skill_names)
            for source, target in combinations(sorted(set(skill_names)), 2):
                edge_counts[(source, target)] += 1

        threshold = sorted(keyword_counts.values(), reverse=True)[max(len(keyword_counts) // 3 - 1, 0)] if keyword_counts else 0
        node_map: dict[str, KeywordNode] = {}
        nodes: list[KeywordNode] = []
        for keyword, count in keyword_counts.items():
            node = KeywordNode(keyword=keyword, job_count=count, trending=count >= threshold)
            session.add(node)
            nodes.append(node)
            node_map[keyword] = node
        session.flush()

        edges: list[KeywordEdge] = []
        for (source_keyword, target_keyword), weight in edge_counts.items():
            edge = KeywordEdge(
                source_id=node_map[source_keyword].id,
                target_id=node_map[target_keyword].id,
                weight=float(weight),
            )
            session.add(edge)
            edges.append(edge)
        session.flush()
        return nodes, edges

    def _seed_inbox_items(self, session: Session, jobs: list[Job]) -> list[InboxItem]:
        items: list[InboxItem] = []
        top_matches = session.execute(select(Match).order_by(Match.score.desc()).limit(35)).scalars().all()

        for match in top_matches[:20]:
            talent = session.get(TalentProfile, match.talent_id)
            job = session.get(Job, match.job_id)
            enterprise = session.get(EnterpriseProfile, job.enterprise_id) if job is not None else None
            if talent is None or job is None:
                continue
            item = self._get_or_create_inbox_item(
                session,
                user_id=talent.user_id,
                item_type="match_notification",
                title=f"New high-fit role: {job.title}",
                content={
                    "jobId": str(job.id),
                    "jobTitle": job.title,
                    "companyName": enterprise.company_name if enterprise is not None else None,
                    "score": round(match.score, 1),
                },
                read=False,
            )
            items.append(item)

        for match in top_matches[5:20]:
            talent = session.get(TalentProfile, match.talent_id)
            job = session.get(Job, match.job_id)
            if talent is None or job is None:
                continue
            enterprise = session.get(EnterpriseProfile, job.enterprise_id)
            if enterprise is None:
                continue
            item = self._get_or_create_inbox_item(
                session,
                user_id=enterprise.user_id,
                item_type="match_notification",
                title=f"Candidate surfaced for {job.title}",
                content={
                    "jobId": str(job.id),
                    "talentId": str(talent.id),
                    "talentName": talent.display_name,
                    "score": round(match.score, 1),
                },
                read=bool(match.score < 82),
            )
            items.append(item)

        for email in DEMO_TALENT_EMAILS:
            profile = session.execute(
                select(TalentProfile)
                .join(User, TalentProfile.user_id == User.id)
                .where(User.email == email)
            ).scalar_one()
            top_match = session.execute(
                select(Match).where(Match.talent_id == profile.id).order_by(Match.score.desc()).limit(1)
            ).scalar_one()
            job = session.get(Job, top_match.job_id)
            enterprise = session.get(EnterpriseProfile, job.enterprise_id) if job is not None else None
            if job is None or enterprise is None:
                continue
            items.append(
                self._get_or_create_inbox_item(
                    session,
                    user_id=profile.user_id,
                    item_type="invite",
                    title=f"Invitation to apply: {job.title}",
                    content={
                        "jobId": str(job.id),
                        "jobTitle": job.title,
                        "companyName": enterprise.company_name,
                        "matchId": str(top_match.id),
                    },
                    read=False,
                )
            )
            top_match.status = "invited"
            items.append(
                self._get_or_create_inbox_item(
                    session,
                    user_id=profile.user_id,
                    item_type="prechat_summary",
                    title=f"AI pre-chat summary for {job.title}",
                    content={
                        "jobId": str(job.id),
                        "jobTitle": job.title,
                        "companyName": enterprise.company_name,
                        "summary": (
                            f"{enterprise.company_name} is looking for someone who can ship {job.title.lower()} "
                            "without long onboarding, and your production experience stood out."
                        ),
                        "highlights": ["high skill overlap", "clear hiring urgency", "strong product fit"],
                    },
                    read=False,
                )
            )

        for email in DEMO_TALENT_EMAILS:
            user = session.execute(select(User).where(User.email == email)).scalar_one()
            for message in SYSTEM_MESSAGES:
                items.append(
                    self._get_or_create_inbox_item(
                        session,
                        user_id=user.id,
                        item_type="system",
                        title=message,
                        content={"message": message, "severity": "info"},
                        read=False,
                    )
                )

        return items

    def _seed_seeking_reports(self, session: Session, jobs: list[Job]) -> list[SeekingReport]:
        reports: list[SeekingReport] = []

        for email in DEMO_TALENT_EMAILS:
            profile = session.execute(
                select(TalentProfile)
                .join(User, TalentProfile.user_id == User.id)
                .where(User.email == email)
            ).scalar_one()
            existing = session.execute(
                select(SeekingReport).where(SeekingReport.talent_id == profile.id).limit(1)
            ).scalar_one_or_none()
            if existing is not None:
                reports.append(existing)
                continue

            matches = session.execute(
                select(Match).where(Match.talent_id == profile.id).order_by(Match.score.desc()).limit(6)
            ).scalars().all()
            high_matches: list[HighMatchItem] = []
            inbound_interest: list[InboundInterestItem] = []
            talent_skill_names = {str(skill["name"]) for skill in (profile.skills or [])}

            for match in matches[:3]:
                job = session.get(Job, match.job_id)
                enterprise = session.get(EnterpriseProfile, job.enterprise_id) if job is not None else None
                if job is None or enterprise is None:
                    continue
                job_skills = [str(skill["name"]) for skill in (job.structured or {}).get("skills", [])]
                high_matches.append(
                    HighMatchItem(
                        matchId=str(match.id),
                        jobId=str(job.id),
                        jobTitle=job.title,
                        companyName=enterprise.company_name or "",
                        location=str((job.structured or {}).get("location") or "Remote"),
                        workMode=str((job.structured or {}).get("workMode") or "remote"),
                        score=round(match.score, 1),
                        skillMatches=[
                            SkillMatch(skill=name, matched=name in talent_skill_names, level="advanced" if name in talent_skill_names else "basic")
                            for name in job_skills
                        ],
                        aiAssessment=match.ai_reasoning or "",
                    )
                )
                inbound_interest.append(
                    InboundInterestItem(
                        matchId=str(match.id),
                        companyName=enterprise.company_name or "",
                        reason="The employer has already signaled strong interest in your background.",
                        score=round(match.score, 1),
                        jobId=str(job.id),
                    )
                )

            prechat_rows = session.execute(
                select(InboxItem)
                .where(InboxItem.user_id == profile.user_id, InboxItem.item_type == "prechat_summary")
                .limit(3)
            ).scalars().all()
            prechat_activity = [
                PreChatItem(
                    inboxItemId=str(item.id),
                    companyName=str(item.content.get("companyName") or ""),
                    jobTitle=str(item.content.get("jobTitle") or ""),
                    summary=str(item.content.get("summary") or ""),
                    generatedAt=item.created_at.isoformat(),
                )
                for item in prechat_rows
            ]

            all_matches = session.execute(select(Match).where(Match.talent_id == profile.id)).scalars().all()
            report_payload = SeekingReportData(
                scanSummary=ScanSummary(
                    totalScanned=len(all_matches),
                    highMatches=sum(1 for item in all_matches if item.score >= 80),
                    mediumMatches=sum(1 for item in all_matches if 60 <= item.score < 80),
                    periodLabel="Last 7 days",
                ),
                highMatches=high_matches,
                preChatActivity=prechat_activity,
                inboundInterest=inbound_interest,
                generatedAt=datetime.now(UTC).isoformat(),
            ).model_dump(by_alias=True)

            report = SeekingReport(talent_id=profile.id, report_data=report_payload)
            session.add(report)
            session.flush()
            reports.append(report)

        return reports

    def _get_or_create_user(self, session: Session, *, email: str, role: str, password_hash: str) -> User:
        existing = session.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if existing is not None:
            return existing
        user = User(email=email, role=role, password_hash=password_hash)
        session.add(user)
        session.flush()
        return user

    def _get_or_create_talent_profile(self, session: Session, *, user: User, values: dict[str, Any]) -> TalentProfile:
        existing = session.execute(select(TalentProfile).where(TalentProfile.user_id == user.id)).scalar_one_or_none()
        if existing is not None:
            return existing
        profile = TalentProfile(user_id=user.id, **values)
        session.add(profile)
        session.flush()
        return profile

    def _get_or_create_enterprise_profile(
        self, session: Session, *, user: User, values: dict[str, Any]
    ) -> EnterpriseProfile:
        existing = session.execute(
            select(EnterpriseProfile).where(EnterpriseProfile.user_id == user.id)
        ).scalar_one_or_none()
        if existing is not None:
            return existing
        profile = EnterpriseProfile(user_id=user.id, **values)
        session.add(profile)
        session.flush()
        return profile

    def _get_or_create_job(
        self,
        session: Session,
        *,
        enterprise: EnterpriseProfile,
        title: str,
        description: str,
        structured: dict[str, Any],
        auto_prechat: bool,
    ) -> Job:
        existing = session.execute(
            select(Job).where(Job.enterprise_id == enterprise.id, Job.title == title)
        ).scalar_one_or_none()
        if existing is not None:
            return existing
        job = Job(
            enterprise_id=enterprise.id,
            title=title,
            description=description,
            structured=structured,
            status="open",
            auto_match=True,
            auto_prechat=auto_prechat,
        )
        session.add(job)
        session.flush()
        return job

    def _get_or_create_match(
        self,
        session: Session,
        *,
        job: Job,
        talent: TalentProfile,
        score: float,
        breakdown: dict[str, Any],
        ai_reasoning: str,
    ) -> Match:
        existing = session.execute(
            select(Match).where(Match.job_id == job.id, Match.talent_id == talent.id)
        ).scalar_one_or_none()
        if existing is not None:
            return existing
        match = Match(
            job_id=job.id,
            talent_id=talent.id,
            score=score,
            breakdown=breakdown,
            status="new",
            ai_reasoning=ai_reasoning,
        )
        session.add(match)
        session.flush()
        return match

    def _get_or_create_inbox_item(
        self,
        session: Session,
        *,
        user_id: UUID,
        item_type: str,
        title: str,
        content: dict[str, Any],
        read: bool,
    ) -> InboxItem:
        existing = session.execute(
            select(InboxItem).where(
                InboxItem.user_id == user_id,
                InboxItem.item_type == item_type,
                InboxItem.title == title,
            )
        ).scalar_one_or_none()
        if existing is not None:
            return existing
        item = InboxItem(user_id=user_id, item_type=item_type, title=title, content=content, read=read)
        session.add(item)
        session.flush()
        return item

    def _unique_name(self, index: int) -> str:
        family = FAMILY_NAMES[index % len(FAMILY_NAMES)]
        given = GIVEN_NAMES[index % len(GIVEN_NAMES)]
        return f"{family}{given}"

    def _skill_bundle(self, category: str, index: int) -> list[str]:
        focus_skills = SKILL_CATALOG[category]
        secondary_categories = [key for key in SKILL_CATALOG if key != category]
        secondary = SKILL_CATALOG[secondary_categories[index % len(secondary_categories)]]
        return focus_skills[:5] + [secondary[index % len(secondary)]]

    def _skill_entries(self, skill_names: list[str], category: str) -> list[dict[str, str]]:
        return [
            {"name": skill_name, "level": "expert" if index < 2 else "advanced", "category": category}
            for index, skill_name in enumerate(skill_names)
        ]

    def _talent_headline(self, category: str, index: int) -> str:
        years = 2 + (index % 9)
        return f"{category} practitioner with {years} years building production AI systems"

    def _talent_bio(self, name: str, category: str, index: int) -> str:
        return (
            f"{name} focuses on {category} work across product delivery, applied research, and cross-functional execution. "
            f"They have led {1 + index % 4} launches involving enterprise AI adoption."
        )

    def _experience_entries(self, category: str, index: int) -> list[dict[str, str]]:
        return [
            {
                "role": f"{category} Engineer",
                "company": f"项目团队 {index % 7 + 1}",
                "dateRange": f"20{18 + index % 6}-20{19 + index % 6}",
                "description": f"Delivered measurable product outcomes using {category} systems in production.",
            },
            {
                "role": "AI Product Builder",
                "company": f"创新实验室 {index % 5 + 1}",
                "dateRange": f"20{20 + index % 4}-Present",
                "description": "Worked across model evaluation, iteration loops, and deployment quality.",
            },
        ]

    def _education_entries(self, index: int) -> list[dict[str, str]]:
        return [
            {
                "school": ["清华大学", "北京大学", "复旦大学", "上海交通大学", "浙江大学"][index % 5],
                "degree": "Master of Engineering",
                "field": "Computer Science",
            }
        ]

    def _goals(self, category: str, index: int) -> dict[str, Any]:
        return {
            "targetRoles": [f"Senior {category} Engineer", "AI Product Lead"],
            "preferredWorkModes": [WORK_MODES[index % len(WORK_MODES)], "remote"],
            "priority": "production impact",
        }

    def _company_website(self, company_name: str) -> str:
        slug = "".join(character for character in company_name.lower() if character.isascii() and character.isalnum())
        if not slug:
            slug = "csv-enterprise"
        return f"https://{slug}.example.com"

    def _enterprise_description(self, company_name: str, focus: str) -> str:
        return (
            f"{company_name} is hiring a focused {focus} team to move from experiments to reliable production AI "
            "with strong delivery ownership."
        )

    def _job_title(self, category: str, offset: int) -> str:
        titles = {
            "NLP/RAG": ["Senior RAG Engineer", "Knowledge Systems Builder"],
            "AI Agent/Framework": ["Agent Platform Engineer", "LLM Workflow Architect"],
            "Data Analysis/ML": ["Applied ML Engineer", "Decision Intelligence Engineer"],
            "Computer Vision": ["Vision Systems Engineer", "Multimodal Product Engineer"],
            "Prompt Engineering": ["Prompt Systems Designer", "AI Quality Engineer"],
            "Fine-tuning/Training": ["Model Training Engineer", "Fine-Tuning Specialist"],
            "Full-stack+AI": ["Full-stack AI Engineer", "AI Product Platform Engineer"],
        }
        return titles[category][offset % 2]

    def _job_description(self, company_name: str, category: str, offset: int) -> str:
        return (
            f"{company_name} needs a {category} operator who can own delivery from problem framing to launch. "
            f"This role focuses on {'shipping customer-facing systems' if offset == 0 else 'improving platform reliability'}."
        )

    def _job_skills(self, skill_names: list[str]) -> list[dict[str, Any]]:
        return [
            {"name": skill_name, "level": "advanced" if index < 2 else "intermediate", "required": True}
            for index, skill_name in enumerate(skill_names)
        ]

    def _deliverables(self, category: str, offset: int) -> list[str]:
        return [
            f"Ship a production-ready {category} workflow",
            "Define quality metrics and review loops",
            "Partner with product and engineering on rollout" if offset == 0 else "Reduce reliability and latency regressions",
        ]
