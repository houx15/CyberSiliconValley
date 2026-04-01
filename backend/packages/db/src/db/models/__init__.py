from __future__ import annotations

from db.base import Base
from db.models.chat_message import ChatMessage
from db.models.chat_session import ChatSession
from db.models.enterprise_profile import EnterpriseProfile
from db.models.inbox_item import InboxItem
from db.models.job import Job
from db.models.keyword_edge import KeywordEdge
from db.models.keyword_node import KeywordNode
from db.models.match import Match
from db.models.memory_space import MemorySpace
from db.models.pre_chat import PreChat, PreChatMessage
from db.models.seeking_report import SeekingReport
from db.models.subscription import SubscriptionTier, UserSubscription
from db.models.talent_profile import TalentProfile
from db.models.user import User

# Import model modules here so Alembic autogenerate can discover them from one place.
__all__ = [
    "Base",
    "ChatMessage",
    "ChatSession",
    "EnterpriseProfile",
    "InboxItem",
    "Job",
    "KeywordEdge",
    "KeywordNode",
    "Match",
    "MemorySpace",
    "PreChat",
    "PreChatMessage",
    "SeekingReport",
    "SubscriptionTier",
    "TalentProfile",
    "User",
    "UserSubscription",
]
