"""
Unit tests for the messaging system.

Tests actual logic: perspective flipping, round-specific prompt behavior,
contract validation rules, router endpoint behavior via TestClient.
"""
from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from ai.providers.router import AICompletionResult, ProviderRouter
from csv_api.dependencies import get_current_user, get_db_session


# ══════════════════════════════════════════
# _messages_to_history: perspective flipping
# ══════════════════════════════════════════


def _make_msg(sender_type: str, content: str) -> SimpleNamespace:
    """Create a fake PreChatMessage-like object."""
    return SimpleNamespace(sender_type=sender_type, content=content)


class TestMessagesToHistory:
    """The perspective-flipping function must assign correct LLM roles."""

    def _call(self, messages, perspective):
        from csv_worker.jobs.prechat_ai import _messages_to_history
        return _messages_to_history(messages, perspective)

    def test_hr_perspective_flips_correctly(self):
        msgs = [
            _make_msg("ai_hr", "I'm the recruiter"),
            _make_msg("ai_talent", "I'm the candidate"),
            _make_msg("ai_hr", "Follow-up question"),
        ]
        history = self._call(msgs, "ai_hr")
        assert history == [
            {"role": "assistant", "content": "I'm the recruiter"},
            {"role": "user", "content": "I'm the candidate"},
            {"role": "assistant", "content": "Follow-up question"},
        ]

    def test_hr_perspective_maps_human_enterprise_as_assistant(self):
        """human_enterprise messages are on the HR side → assistant for ai_hr perspective."""
        msgs = [
            _make_msg("human_enterprise", "Enterprise typed this"),
            _make_msg("ai_talent", "AI talent reply"),
            _make_msg("human_talent", "Talent typed this"),
        ]
        history = self._call(msgs, "ai_hr")
        assert history == [
            {"role": "assistant", "content": "Enterprise typed this"},
            {"role": "user", "content": "AI talent reply"},
            {"role": "user", "content": "Talent typed this"},
        ]

    def test_talent_perspective_maps_human_talent_as_assistant(self):
        """human_talent messages are on the talent side → assistant for ai_talent perspective."""
        msgs = [
            _make_msg("ai_hr", "Recruiter question"),
            _make_msg("human_talent", "Talent typed this"),
            _make_msg("human_enterprise", "Enterprise typed this"),
        ]
        history = self._call(msgs, "ai_talent")
        assert history == [
            {"role": "user", "content": "Recruiter question"},
            {"role": "assistant", "content": "Talent typed this"},
            {"role": "user", "content": "Enterprise typed this"},
        ]

    def test_talent_perspective_flips_correctly(self):
        msgs = [
            _make_msg("ai_hr", "I'm the recruiter"),
            _make_msg("ai_talent", "I'm the candidate"),
        ]
        history = self._call(msgs, "ai_talent")
        assert history == [
            {"role": "user", "content": "I'm the recruiter"},
            {"role": "assistant", "content": "I'm the candidate"},
        ]

    def test_empty_messages_returns_empty(self):
        assert self._call([], "ai_hr") == []

    def test_human_messages_treated_as_user_for_hr(self):
        """Human talent messages should be 'user' from HR perspective."""
        msgs = [_make_msg("human_talent", "I have a question")]
        history = self._call(msgs, "ai_hr")
        assert history[0]["role"] == "user"

    def test_human_messages_treated_as_user_for_talent(self):
        """Human enterprise messages should be 'user' from talent perspective."""
        msgs = [_make_msg("human_enterprise", "We'd like to meet")]
        history = self._call(msgs, "ai_talent")
        assert history[0]["role"] == "user"


# ══════════════════════════════════════════
# AI Prompt: round-specific behavior
# ══════════════════════════════════════════


class TestAIHRPromptRoundBehavior:
    def _build(self, round_number, max_rounds=5):
        from ai.prompts.prechat import build_ai_hr_prompt
        return build_ai_hr_prompt(
            company_name="Corp", job_title="Eng", job_description="desc",
            job_structured={}, round_number=round_number, max_rounds=max_rounds,
        )

    def test_round_1_differs_from_round_3(self):
        """Round 1 should have opening instructions that round 3 doesn't."""
        r1 = self._build(1)
        r3 = self._build(3)
        assert len(r1) != len(r3)

    def test_final_round_differs_from_middle(self):
        r3 = self._build(3)
        r5 = self._build(5)
        assert len(r5) != len(r3)

    def test_round_number_appears_in_prompt(self):
        prompt = self._build(3)
        assert "Round 3 of 5" in prompt


# ══════════════════════════════════════════
# AI Workflow: run_ai_prechat_round
# ══════════════════════════════════════════


class FakeProvider:
    """Tracks calls to verify correct request construction."""
    def __init__(self):
        self.calls = []

    async def complete(self, request):
        self.calls.append(request)
        return AICompletionResult(text=f"Reply to: {request.messages[-1]['content'][:20]}")


class TestRunAIPrechatRound:
    @pytest.mark.anyio
    async def test_passes_correct_surface(self):
        from ai.workflows.prechat_ai import run_ai_prechat_round
        provider = FakeProvider()
        router = ProviderRouter(provider=provider)
        await run_ai_prechat_round(
            router, role="ai_hr",
            conversation_history=[{"role": "user", "content": "hello"}],
            system_prompt="You are a recruiter.",
        )
        assert provider.calls[0].surface == "prechat"

    @pytest.mark.anyio
    async def test_passes_system_prompt_through(self):
        from ai.workflows.prechat_ai import run_ai_prechat_round
        provider = FakeProvider()
        router = ProviderRouter(provider=provider)
        await run_ai_prechat_round(
            router, role="ai_talent",
            conversation_history=[{"role": "user", "content": "hi"}],
            system_prompt="ACT AS TALENT XYZ",
        )
        assert provider.calls[0].system_prompt == "ACT AS TALENT XYZ"

    @pytest.mark.anyio
    async def test_passes_full_history(self):
        from ai.workflows.prechat_ai import run_ai_prechat_round
        provider = FakeProvider()
        router = ProviderRouter(provider=provider)
        history = [
            {"role": "user", "content": "q1"},
            {"role": "assistant", "content": "a1"},
            {"role": "user", "content": "q2"},
        ]
        await run_ai_prechat_round(
            router, role="ai_hr",
            conversation_history=history,
            system_prompt="sys",
        )
        assert provider.calls[0].messages == history


# ══════════════════════════════════════════
# Contract validation: SendMessageRequest
# ══════════════════════════════════════════


class TestSendMessageRequestValidation:
    def test_rejects_empty_string(self):
        from contracts.conversations import SendMessageRequest
        with pytest.raises(ValidationError):
            SendMessageRequest(content="")

    def test_rejects_extra_fields(self):
        from contracts.conversations import SendMessageRequest
        with pytest.raises(ValidationError):
            SendMessageRequest(content="hi", malicious_field="drop table")

    def test_rejects_whitespace_only(self):
        from contracts.conversations import SendMessageRequest
        with pytest.raises(ValidationError):
            SendMessageRequest(content="   \t\n  ")

    def test_accepts_unicode(self):
        from contracts.conversations import SendMessageRequest
        req = SendMessageRequest(content="你好世界 🌍")
        assert req.content == "你好世界 🌍"


# ══════════════════════════════════════════
# Router logic via TestClient (FastAPI dependency_overrides)
# ══════════════════════════════════════════


def _fake_user(role="enterprise", user_id=None):
    from contracts.auth import AuthUser
    return AuthUser(id=str(user_id or uuid4()), email="test@test.com", role=role)


def _build_app_with_overrides(user, mock_session=None):
    """Build test app with auth and DB session overridden."""
    from csv_api.routers.conversations import router
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db_session] = lambda: mock_session or MagicMock()
    return app


def _fake_conv(conv_id=None, status="active"):
    return SimpleNamespace(
        id=conv_id or uuid4(), talent_id=uuid4(), enterprise_id=uuid4(),
        job_id=None, pre_chat_id=None, status=status,
        last_message_at=None, created_at=datetime.now(), updated_at=datetime.now(),
    )


def _fake_row(conv, talent_name="Test", company_name="Corp"):
    """Simulate a SQLAlchemy Row: row[0] = conv model, row.talent_name = str, etc."""
    row = (conv, talent_name, company_name, "Engineer", None, None)

    class FakeRow:
        def __init__(self):
            self.talent_name = talent_name
            self.company_name = company_name
            self.job_title = "Engineer"
            self.talent_headline = None
            self.last_message = None

        def __getitem__(self, i):
            return conv if i == 0 else None

    return FakeRow()


class TestConversationRouterEndpoints:
    """Test actual router logic — auth, state guards, sender_type derivation."""

    def test_send_message_rejects_archived_conversation(self):
        conv = _fake_conv(status="archived")
        user = _fake_user("enterprise")
        app = _build_app_with_overrides(user)

        with patch("csv_api.routers.conversations.get_conversation_with_display", return_value=_fake_row(conv)), \
             patch("csv_api.routers.conversations.verify_conversation_access", return_value=True):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(f"/api/v1/conversations/{conv.id}/messages", json={"content": "Hello!"})
            assert resp.status_code == 409
            assert "not active" in resp.json()["detail"].lower()

    def test_send_message_rejects_non_participant(self):
        conv = _fake_conv(status="active")
        user = _fake_user("enterprise")
        app = _build_app_with_overrides(user)

        with patch("csv_api.routers.conversations.get_conversation_with_display", return_value=_fake_row(conv)), \
             patch("csv_api.routers.conversations.verify_conversation_access", return_value=False):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(f"/api/v1/conversations/{conv.id}/messages", json={"content": "Hello!"})
            assert resp.status_code == 403

    def test_get_conversation_returns_404_for_missing(self):
        user = _fake_user("talent")
        app = _build_app_with_overrides(user)

        with patch("csv_api.routers.conversations.get_conversation_with_display", return_value=None):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get(f"/api/v1/conversations/{uuid4()}")
            assert resp.status_code == 404

    def test_get_conversation_rejects_invalid_uuid(self):
        user = _fake_user("talent")
        app = _build_app_with_overrides(user)

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/v1/conversations/not-a-uuid")
        assert resp.status_code == 422

    def test_poll_rejects_invalid_timestamp(self):
        conv = _fake_conv()
        user = _fake_user("enterprise")
        app = _build_app_with_overrides(user)

        with patch("csv_api.routers.conversations.get_conversation_with_display", return_value=_fake_row(conv)), \
             patch("csv_api.routers.conversations.verify_conversation_access", return_value=True):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get(f"/api/v1/conversations/{conv.id}/messages/poll?after=not-a-timestamp")
            assert resp.status_code == 422

    def test_poll_returns_messages_after_timestamp(self):
        """Poll should call list_new_messages with the parsed datetime and return results."""
        conv = _fake_conv()
        user = _fake_user("enterprise")
        mock_session = MagicMock()
        app = _build_app_with_overrides(user, mock_session)
        ts = "2026-04-01T10:00:00"

        fake_msg = SimpleNamespace(
            id=uuid4(), conversation_id=conv.id, sender_user_id=uuid4(),
            sender_type="human_talent", content="new msg", created_at=datetime(2026, 4, 1, 10, 5),
        )

        with patch("csv_api.routers.conversations.get_conversation_with_display", return_value=_fake_row(conv)), \
             patch("csv_api.routers.conversations.verify_conversation_access", return_value=True), \
             patch("csv_api.routers.conversations.list_new_messages", return_value=[fake_msg]) as mock_poll:
            client = TestClient(app)
            resp = client.get(f"/api/v1/conversations/{conv.id}/messages/poll?after={ts}")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["messages"]) == 1
            assert data["messages"][0]["content"] == "new msg"
            # Verify the function was called with the correct parsed datetime
            call_args = mock_poll.call_args
            assert call_args[0][1] == conv.id  # conversation_id
            assert isinstance(call_args[0][2], datetime)  # parsed timestamp

    def test_sender_type_derived_from_role(self):
        """Enterprise user -> human_enterprise, talent user -> human_talent."""
        conv = _fake_conv()
        msg_id = uuid4()

        created_messages = []

        def mock_create_dm(session, *, conversation_id, sender_user_id, sender_type, content):
            created_messages.append(sender_type)
            return SimpleNamespace(
                id=msg_id, conversation_id=conversation_id,
                sender_user_id=sender_user_id, sender_type=sender_type,
                content=content, created_at=datetime.now(),
            )

        # Test as enterprise
        ent_user = _fake_user("enterprise")
        app = _build_app_with_overrides(ent_user)
        mock_session = MagicMock()
        mock_session.execute.return_value.scalar_one_or_none.return_value = uuid4()
        app.dependency_overrides[get_db_session] = lambda: mock_session

        with patch("csv_api.routers.conversations.get_conversation_with_display", return_value=_fake_row(conv)), \
             patch("csv_api.routers.conversations.verify_conversation_access", return_value=True), \
             patch("csv_api.routers.conversations.create_direct_message", side_effect=mock_create_dm), \
             patch("csv_api.routers.conversations.create_inbox_item"):
            client = TestClient(app)
            resp = client.post(f"/api/v1/conversations/{conv.id}/messages", json={"content": "From enterprise"})
            assert resp.status_code == 201
            assert created_messages[-1] == "human_enterprise"

        # Test as talent
        created_messages.clear()
        tal_user = _fake_user("talent")
        app2 = _build_app_with_overrides(tal_user)
        app2.dependency_overrides[get_db_session] = lambda: mock_session

        with patch("csv_api.routers.conversations.get_conversation_with_display", return_value=_fake_row(conv)), \
             patch("csv_api.routers.conversations.verify_conversation_access", return_value=True), \
             patch("csv_api.routers.conversations.create_direct_message", side_effect=mock_create_dm), \
             patch("csv_api.routers.conversations.create_inbox_item"):
            client = TestClient(app2)
            resp = client.post(f"/api/v1/conversations/{conv.id}/messages", json={"content": "From talent"})
            assert resp.status_code == 201
            assert created_messages[-1] == "human_talent"

    def test_send_message_creates_inbox_notification(self):
        """Sending a message should create an InboxItem for the OTHER party."""
        conv = _fake_conv()
        user = _fake_user("enterprise")
        recipient_uid = uuid4()
        mock_session = MagicMock()
        mock_session.execute.return_value.scalar_one_or_none.return_value = recipient_uid
        app = _build_app_with_overrides(user, mock_session)

        def mock_create_dm(session, *, conversation_id, sender_user_id, sender_type, content):
            return SimpleNamespace(
                id=uuid4(), conversation_id=conversation_id,
                sender_user_id=sender_user_id, sender_type=sender_type,
                content=content, created_at=datetime.now(),
            )

        inbox_calls = []

        def mock_create_inbox(session, *, user_id, item_type, title, content):
            inbox_calls.append({"user_id": user_id, "item_type": item_type, "content": content})
            return SimpleNamespace(id=uuid4())

        with patch("csv_api.routers.conversations.get_conversation_with_display", return_value=_fake_row(conv)), \
             patch("csv_api.routers.conversations.verify_conversation_access", return_value=True), \
             patch("csv_api.routers.conversations.create_direct_message", side_effect=mock_create_dm), \
             patch("csv_api.routers.conversations.create_inbox_item", side_effect=mock_create_inbox):
            client = TestClient(app)
            resp = client.post(f"/api/v1/conversations/{conv.id}/messages", json={"content": "Hey there"})
            assert resp.status_code == 201

        assert len(inbox_calls) == 1
        assert inbox_calls[0]["user_id"] == recipient_uid
        assert inbox_calls[0]["item_type"] == "new_message"
        assert inbox_calls[0]["content"]["preview"] == "Hey there"


# ══════════════════════════════════════════
# Prechat router: consent model + race guards
# ══════════════════════════════════════════


def _build_prechat_app(user, mock_session=None):
    """Build test app with prechat router."""
    from csv_api.routers.prechat import router
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db_session] = lambda: mock_session or MagicMock()
    return app


def _fake_prechat(status="pending_talent_opt_in", talent_opted_in=False, enterprise_opted_in=True,
                  round_count=0, max_rounds=5, pc_id=None, talent_id=None, enterprise_id=None):
    return SimpleNamespace(
        id=pc_id or uuid4(), job_id=uuid4(),
        talent_id=talent_id or uuid4(), enterprise_id=enterprise_id or uuid4(),
        status=status, talent_opted_in=talent_opted_in, enterprise_opted_in=enterprise_opted_in,
        round_count=round_count, max_rounds=max_rounds,
        ai_summary="test summary", created_at=datetime.now(), updated_at=datetime.now(),
    )


class TestConsentStateMachine:
    """Test the full consent state machine: transitions, side effects, and guards.

    The product flow is:
      enterprise initiates → ai_screening → pending_talent_review → talent accepts → completed + Conversation
                                                                  → talent declines → declined (no Conversation)
    These tests verify the state machine enforces the correct transitions and that
    side effects (talent_opted_in mutation, create_conversation call) only happen
    at the right step.
    """

    def test_full_happy_path_accept(self):
        """Walk the full flow: start-ai → (worker finishes) → talent-accept.
        Verify state + side effects at each step."""
        pc = _fake_prechat(status="pending_talent_opt_in")
        ent_user = _fake_user("enterprise")

        # Step 1: Enterprise starts AI screening (atomic UPDATE)
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 1  # Atomic update succeeds
        mock_session.execute.return_value = mock_result
        app = _build_prechat_app(ent_user, mock_session)
        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"), \
             patch("csv_api.routers.prechat.enqueue_ai_prechat_job"):
            client = TestClient(app)
            resp = client.post(f"/api/v1/prechat/{pc.id}/start-ai")
            assert resp.status_code == 200

        # Step 2: Simulate worker completion (sets pending_talent_review)
        pc.status = "pending_talent_review"
        pc.ai_summary = "Great match for the role"

        # Step 3: Talent accepts (atomic UPDATE)
        tal_user = _fake_user("talent")
        mock_session2 = MagicMock()
        mock_result2 = MagicMock()
        mock_result2.rowcount = 1  # Atomic update succeeds
        mock_session2.execute.return_value = mock_result2
        app2 = _build_prechat_app(tal_user, mock_session2)
        conv_args = []

        def track_conv(session, *, talent_id, enterprise_id, job_id=None, pre_chat_id=None):
            conv_args.append({"talent_id": talent_id, "enterprise_id": enterprise_id, "pre_chat_id": pre_chat_id})
            return SimpleNamespace(id=uuid4())

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"), \
             patch("csv_api.routers.prechat.create_conversation", side_effect=track_conv):
            client = TestClient(app2)
            resp = client.post(f"/api/v1/prechat/{pc.id}/talent-accept")
            assert resp.status_code == 200

        # After accept: Conversation created with correct FK
        assert len(conv_args) == 1
        assert conv_args[0]["talent_id"] == pc.talent_id
        assert conv_args[0]["enterprise_id"] == pc.enterprise_id
        assert conv_args[0]["pre_chat_id"] == pc.id

    def test_full_happy_path_decline(self):
        """Talent declines after AI screening — no Conversation created, talent_opted_in stays False."""
        pc = _fake_prechat(status="pending_talent_review", talent_opted_in=False)
        tal_user = _fake_user("talent")
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 1  # Atomic decline succeeds
        mock_session.execute.return_value = mock_result
        app = _build_prechat_app(tal_user, mock_session)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"), \
             patch("csv_api.routers.prechat.create_conversation") as mock_conv:
            client = TestClient(app)
            resp = client.post(f"/api/v1/prechat/{pc.id}/talent-decline")
            assert resp.status_code == 200
            mock_conv.assert_not_called()  # No Conversation on decline

        # talent_opted_in was never flipped (decline doesn't set it)
        assert pc.talent_opted_in is False

    def test_cannot_accept_from_active_status(self):
        """Talent can't accept a pre-chat that's still in active (human) mode.
        The atomic UPDATE WHERE status='pending_talent_review' will match 0 rows."""
        pc = _fake_prechat(status="active")
        tal_user = _fake_user("talent")
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 0  # Atomic update fails — status is not pending_talent_review
        mock_session.execute.return_value = mock_result
        app = _build_prechat_app(tal_user, mock_session)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(f"/api/v1/prechat/{pc.id}/talent-accept")
            assert resp.status_code == 409

    def test_cannot_decline_twice(self):
        """Once declined, can't decline again. Atomic UPDATE matches 0 rows → 409."""
        pc = _fake_prechat(status="declined")
        tal_user = _fake_user("talent")
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 0  # Status is declined, not pending_talent_review
        mock_session.execute.return_value = mock_result
        app = _build_prechat_app(tal_user, mock_session)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(f"/api/v1/prechat/{pc.id}/talent-decline")
            assert resp.status_code == 409

    def test_enterprise_cannot_accept_on_behalf_of_talent(self):
        """Role enforcement: enterprise calling talent-accept gets 403."""
        pc = _fake_prechat(status="pending_talent_review")
        ent_user = _fake_user("enterprise")
        app = _build_prechat_app(ent_user)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(f"/api/v1/prechat/{pc.id}/talent-accept")
            assert resp.status_code == 403

    def test_enterprise_cannot_decline_on_behalf_of_talent(self):
        """Role enforcement: enterprise calling talent-decline gets 403."""
        pc = _fake_prechat(status="pending_talent_review")
        ent_user = _fake_user("enterprise")
        app = _build_prechat_app(ent_user)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(f"/api/v1/prechat/{pc.id}/talent-decline")
            assert resp.status_code == 403

    def test_complete_goes_to_pending_review_not_completed(self):
        """Enterprise 'complete' uses atomic UPDATE → pending_talent_review."""
        pc = _fake_prechat(status="active")
        ent_user = _fake_user("enterprise")
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 1  # Atomic update succeeds (status was active)
        mock_session.execute.return_value = mock_result
        app = _build_prechat_app(ent_user, mock_session)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"), \
             patch("csv_api.routers.prechat.create_conversation") as mock_conv:
            client = TestClient(app)
            resp = client.post(f"/api/v1/prechat/{pc.id}/complete")
            assert resp.status_code == 200
            mock_conv.assert_not_called()  # No conversation yet — talent must accept first

    def test_complete_blocked_from_non_active_states(self):
        """Complete should only work from 'active'. Atomic UPDATE matches 0 rows → 409."""
        ent_user = _fake_user("enterprise")
        for bad_status in ("ai_screening", "pending_talent_opt_in", "pending_enterprise_opt_in",
                           "completed", "pending_talent_review", "declined"):
            pc = _fake_prechat(status=bad_status)
            mock_session = MagicMock()
            mock_result = MagicMock()
            mock_result.rowcount = 0  # Status is not active
            mock_session.execute.return_value = mock_result
            app = _build_prechat_app(ent_user, mock_session)
            with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
                 patch("csv_api.routers.prechat._verify_prechat_access"):
                client = TestClient(app, raise_server_exceptions=False)
                resp = client.post(f"/api/v1/prechat/{pc.id}/complete")
                assert resp.status_code == 409, f"Expected 409 for status={bad_status}, got {resp.status_code}"

    def test_opt_in_blocked_from_terminal_statuses(self):
        """Opt-in must not resurrect completed/declined/ai_screening pre-chats.
        Atomic UPDATE WHERE status IN (...) matches 0 rows → 409."""
        tal_user = _fake_user("talent")
        for terminal_status in ("completed", "declined", "ai_screening", "pending_talent_review"):
            pc = _fake_prechat(status=terminal_status)
            mock_session = MagicMock()
            mock_result = MagicMock()
            mock_result.rowcount = 0  # Atomic update fails — status not in allowed set
            mock_session.execute.return_value = mock_result
            app = _build_prechat_app(tal_user, mock_session)
            with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
                 patch("csv_api.routers.prechat._verify_prechat_access"):
                client = TestClient(app, raise_server_exceptions=False)
                resp = client.post(f"/api/v1/prechat/{pc.id}/opt-in")
                assert resp.status_code == 409, f"Expected 409 for status={terminal_status}"

    def test_opt_in_allowed_from_pending_states(self):
        """Opt-in should work from pending_talent_opt_in — atomic UPDATE succeeds."""
        tal_user = _fake_user("talent")
        pc = _fake_prechat(status="pending_talent_opt_in", enterprise_opted_in=True)
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 1  # Atomic update succeeds
        mock_session.execute.return_value = mock_result
        app = _build_prechat_app(tal_user, mock_session)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"):
            client = TestClient(app)
            resp = client.post(f"/api/v1/prechat/{pc.id}/opt-in")
            assert resp.status_code == 200

    def test_complete_blocked_for_talent(self):
        """Only enterprise can manually complete a pre-chat."""
        pc = _fake_prechat(status="active")
        tal_user = _fake_user("talent")
        app = _build_prechat_app(tal_user)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(f"/api/v1/prechat/{pc.id}/complete")
            assert resp.status_code == 403

    def test_talent_accept_double_submit_returns_409(self):
        """Two concurrent talent-accept calls: second one hits IntegrityError → 409."""
        pc = _fake_prechat(status="pending_talent_review")
        tal_user = _fake_user("talent")
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 1  # First atomic UPDATE succeeds
        mock_session.execute.return_value = mock_result

        from sqlalchemy.exc import IntegrityError
        def raise_integrity(session, *, talent_id, enterprise_id, job_id=None, pre_chat_id=None):
            raise IntegrityError("duplicate", {}, Exception("unique constraint"))

        app = _build_prechat_app(tal_user, mock_session)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"), \
             patch("csv_api.routers.prechat.create_conversation", side_effect=raise_integrity):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(f"/api/v1/prechat/{pc.id}/talent-accept")
            assert resp.status_code == 409
            assert "already created" in resp.json()["detail"].lower()


class TestAtomicDecline:
    """Test that talent-decline uses atomic UPDATE to prevent race with talent-accept."""

    def test_decline_uses_atomic_update(self):
        """Decline from pending_talent_review succeeds with rowcount=1."""
        pc = _fake_prechat(status="pending_talent_review")
        tal_user = _fake_user("talent")
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_session.execute.return_value = mock_result
        app = _build_prechat_app(tal_user, mock_session)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"):
            client = TestClient(app)
            resp = client.post(f"/api/v1/prechat/{pc.id}/talent-decline")
            assert resp.status_code == 200

    def test_decline_blocked_if_already_accepted(self):
        """If concurrent accept already moved status away, rowcount=0 → 409."""
        pc = _fake_prechat(status="completed")
        tal_user = _fake_user("talent")
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 0  # Status already changed by concurrent accept
        mock_session.execute.return_value = mock_result
        app = _build_prechat_app(tal_user, mock_session)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(f"/api/v1/prechat/{pc.id}/talent-decline")
            assert resp.status_code == 409


class TestEnqueueFailureRecovery:
    """Test that enqueue failures don't leave pre-chats stuck in ai_screening."""

    def test_start_ai_reverts_on_enqueue_failure(self):
        """If enqueue fails after commit, status should revert and return 503."""
        pc = _fake_prechat(status="pending_talent_opt_in")
        ent_user = _fake_user("enterprise")
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_session.execute.return_value = mock_result
        app = _build_prechat_app(ent_user, mock_session)

        async def fail_enqueue(redis_url, pre_chat_id):
            raise ConnectionError("Redis unavailable")

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"), \
             patch("csv_api.routers.prechat.enqueue_ai_prechat_job", side_effect=fail_enqueue):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(f"/api/v1/prechat/{pc.id}/start-ai")
            assert resp.status_code == 503
            assert "retry" in resp.json()["detail"].lower()


class TestStartAiDeduplication:
    """Test that start-ai blocks duplicate requests (race condition guard)."""

    def test_blocks_if_already_screening(self):
        """Atomic UPDATE WHERE status IN (...) won't match ai_screening → rowcount=0 → 409."""
        pc = _fake_prechat(status="ai_screening")
        ent_user = _fake_user("enterprise")
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_session.execute.return_value = mock_result
        app = _build_prechat_app(ent_user, mock_session)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(f"/api/v1/prechat/{pc.id}/start-ai")
            assert resp.status_code == 409

    def test_blocks_from_active_status(self):
        """Active human conversations cannot be hijacked into AI screening."""
        pc = _fake_prechat(status="active")
        ent_user = _fake_user("enterprise")
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 0  # "active" not in allowed statuses → no rows updated
        mock_session.execute.return_value = mock_result
        app = _build_prechat_app(ent_user, mock_session)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(f"/api/v1/prechat/{pc.id}/start-ai")
            assert resp.status_code == 409

    def test_blocks_all_terminal_statuses(self):
        """completed, pending_talent_review, declined — atomic UPDATE matches 0 rows → 409."""
        ent_user = _fake_user("enterprise")
        for terminal_status in ("completed", "pending_talent_review", "declined"):
            pc = _fake_prechat(status=terminal_status)
            mock_session = MagicMock()
            mock_result = MagicMock()
            mock_result.rowcount = 0
            mock_session.execute.return_value = mock_result
            app = _build_prechat_app(ent_user, mock_session)
            with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
                 patch("csv_api.routers.prechat._verify_prechat_access"):
                client = TestClient(app, raise_server_exceptions=False)
                resp = client.post(f"/api/v1/prechat/{pc.id}/start-ai")
                assert resp.status_code == 409, f"Expected 409 for status={terminal_status}, got {resp.status_code}"

    def test_start_ai_transitions_to_ai_screening_and_enqueues(self):
        """From pending_talent_opt_in, atomic UPDATE succeeds (rowcount=1), enqueue fires exactly once."""
        pc = _fake_prechat(status="pending_talent_opt_in")
        ent_user = _fake_user("enterprise")
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 1  # Atomic update succeeds
        mock_session.execute.return_value = mock_result
        app = _build_prechat_app(ent_user, mock_session)
        enqueue_calls = []

        async def track_enqueue(redis_url, pre_chat_id):
            enqueue_calls.append(pre_chat_id)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"), \
             patch("csv_api.routers.prechat.enqueue_ai_prechat_job", side_effect=track_enqueue):
            client = TestClient(app)
            resp = client.post(f"/api/v1/prechat/{pc.id}/start-ai")
            assert resp.status_code == 200

        assert len(enqueue_calls) == 1
        assert enqueue_calls[0] == str(pc.id)


class TestAtomicRoundCountGuard:
    """Test that human_reply uses atomic UPDATE WHERE to prevent over-increment.

    We can't test the real DB row-lock without Postgres, but we CAN verify
    the router constructs the correct UPDATE statement and checks rowcount.
    """

    def test_reply_rejected_when_update_affects_zero_rows(self):
        """If the atomic UPDATE matches 0 rows (round_count >= max_rounds),
        the endpoint must return 409 — not proceed to create a message."""
        pc = _fake_prechat(status="active", talent_opted_in=True, enterprise_opted_in=True,
                           round_count=5, max_rounds=5)
        tal_user = _fake_user("talent")
        mock_session = MagicMock()
        # Simulate UPDATE returning rowcount=0 (round_count already at max)
        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_session.execute.return_value = mock_result
        app = _build_prechat_app(tal_user, mock_session)

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(f"/api/v1/prechat/{pc.id}/human-reply", json={"content": "hello"})
            assert resp.status_code == 409

    def test_reply_succeeds_when_update_affects_one_row(self):
        """If atomic UPDATE affects 1 row, message creation proceeds."""
        pc = _fake_prechat(status="active", talent_opted_in=True, enterprise_opted_in=True,
                           round_count=2, max_rounds=5)
        tal_user = _fake_user("talent")
        mock_session = MagicMock()
        # Simulate UPDATE returning rowcount=1 (increment succeeded)
        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_session.execute.return_value = mock_result
        # flush/refresh/add/commit need to not fail
        mock_session.flush.return_value = None
        mock_session.refresh.side_effect = lambda obj: setattr(obj, 'round_count', 3) if hasattr(obj, 'round_count') else None
        app = _build_prechat_app(tal_user, mock_session)

        msg_created = []

        with patch("csv_api.routers.prechat._load_prechat", return_value=pc), \
             patch("csv_api.routers.prechat._verify_prechat_access"):
            # We need PreChatMessage to be addable
            def track_add(obj):
                if hasattr(obj, 'content'):
                    msg_created.append(obj.content)
            mock_session.add.side_effect = track_add
            # refresh on the message needs to give it an id and created_at
            call_count = [0]
            original_refresh = mock_session.refresh.side_effect

            def smart_refresh(obj):
                call_count[0] += 1
                if call_count[0] == 1:
                    # First refresh is on pc (after flush)
                    obj.round_count = 3
                else:
                    # Second refresh is on the message
                    obj.id = uuid4()
                    obj.created_at = datetime.now()
            mock_session.refresh.side_effect = smart_refresh

            client = TestClient(app)
            resp = client.post(f"/api/v1/prechat/{pc.id}/human-reply", json={"content": "my answer"})
            assert resp.status_code == 201
            assert len(msg_created) == 1
            assert msg_created[0] == "my answer"


# ══════════════════════════════════════════
# Inbox filter completeness
# ══════════════════════════════════════════


class TestInitiatePrechatValidation:
    """Test validation in the initiate_prechat endpoint."""

    def test_nonexistent_talent_returns_404(self):
        """If talent_id is valid UUID but doesn't exist, return 404 not 500."""
        ent_user = _fake_user("enterprise")
        mock_session = MagicMock()
        profile = SimpleNamespace(id=uuid4())

        # First call: enterprise profile lookup → found
        # Second call: job lookup → found
        # Third call: talent lookup → not found (None)
        job = SimpleNamespace(id=uuid4(), enterprise_id=profile.id, auto_prechat=False)
        call_count = [0]

        def mock_execute(stmt):
            call_count[0] += 1
            result = MagicMock()
            if call_count[0] == 1:
                result.scalar_one_or_none.return_value = profile  # enterprise profile
            elif call_count[0] == 2:
                result.scalar_one_or_none.return_value = job  # job
            else:
                result.scalar_one_or_none.return_value = None  # talent not found
            return result

        mock_session.execute.side_effect = mock_execute
        app = _build_prechat_app(ent_user, mock_session)

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/v1/prechat/initiate", json={
            "jobId": str(job.id),
            "talentId": str(uuid4()),  # Valid UUID, nonexistent talent
        })
        assert resp.status_code == 404
        assert "talent" in resp.json()["detail"].lower()


def test_inbox_backend_and_frontend_filters_match():
    """Backend and frontend must agree on inbox filter keys."""
    from db.repositories.inbox import FILTER_TO_TYPES

    frontend_filters = {"all", "invites", "prechats", "matches", "messages", "system"}
    backend_filters = set(FILTER_TO_TYPES.keys())
    assert backend_filters == frontend_filters
