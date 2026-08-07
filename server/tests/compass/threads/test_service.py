from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from pydantic_ai.messages import (
    ModelMessagesTypeAdapter,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)

from polar.auth.models import AuthSubject, Organization, User
from polar.compass.threads.service import HISTORY_TURNS
from polar.compass.threads.service import (
    compass_thread as compass_thread_service,
)
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.models import CompassThread, CompassThreadMessage, UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

UTC = ZoneInfo("UTC")


def _turn_model_messages(prompt: str, answer: str) -> list[dict[str, Any]]:
    return ModelMessagesTypeAdapter.dump_python(
        [
            ModelRequest(parts=[UserPromptPart(content=prompt)]),
            ModelResponse(parts=[TextPart(content=answer)]),
        ],
        mode="json",
    )


def _turn_with_tool_call(
    prompt: str, tool_result: str, answer: str
) -> list[dict[str, Any]]:
    return ModelMessagesTypeAdapter.dump_python(
        [
            ModelRequest(parts=[UserPromptPart(content=prompt)]),
            ModelResponse(parts=[ToolCallPart(tool_name="get_metrics", args={})]),
            ModelRequest(
                parts=[
                    ToolReturnPart(tool_name="get_metrics", content=tool_result),
                ]
            ),
            ModelResponse(parts=[TextPart(content=answer)]),
        ],
        mode="json",
    )


def _tool_results(history: list[Any]) -> list[Any]:
    return [
        part.content
        for message in history
        if isinstance(message, ModelRequest)
        for part in message.parts
        if isinstance(part, ToolReturnPart)
    ]


async def _create_thread(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    user: User,
    title: str = "Thread",
    created_at: datetime | None = None,
) -> CompassThread:
    thread = CompassThread(
        organization_id=organization.id,
        user_id=user.id,
        title=title,
    )
    if created_at is not None:
        thread.created_at = created_at
    await save_fixture(thread)
    return thread


async def _create_messages(
    save_fixture: SaveFixture, thread: CompassThread, count: int
) -> None:
    """`count` turns named `q0`…`q{count - 1}`, oldest first."""
    now = utc_now()
    for turn in range(count):
        await save_fixture(
            CompassThreadMessage(
                thread=thread,
                prompt=f"q{turn}",
                parts=[],
                model_messages=[],
                created_at=now + timedelta(seconds=turn),
            )
        )


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth
    async def test_user_thread_is_owned_and_titled(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user: User,
        organization: Organization,
    ) -> None:
        thread = await compass_thread_service.create(
            session,
            auth_subject,
            organization_id=organization.id,
            prompt="  How is   my MRR\ntrending?  ",
        )

        assert thread.user_id == user.id
        assert thread.organization_id == organization.id
        assert thread.title == "How is my MRR trending?"

    @pytest.mark.auth
    async def test_long_prompt_is_truncated(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
    ) -> None:
        thread = await compass_thread_service.create(
            session, auth_subject, organization_id=organization.id, prompt="x" * 500
        )

        assert len(thread.title) <= 80
        assert thread.title.endswith("…")

    @pytest.mark.auth
    async def test_keeps_existing_threads(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user: User,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        now = utc_now()
        existing = await _create_thread(
            save_fixture, organization, user=user, created_at=now - timedelta(hours=2)
        )

        created = await compass_thread_service.create(
            session, auth_subject, organization_id=organization.id, prompt="hi"
        )

        results, count = await compass_thread_service.list(
            session,
            auth_subject,
            organization_id=organization.id,
            pagination=PaginationParams(1, 10),
        )
        assert count == 2
        assert {t.id for t in results} == {created.id, existing.id}
        assert existing.deleted_at is None


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth
    async def test_user_sees_only_their_threads(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        mine = await _create_thread(save_fixture, organization, user=user)
        await _create_thread(save_fixture, organization, user=user_second)

        results, count = await compass_thread_service.list(
            session,
            auth_subject,
            organization_id=organization.id,
            pagination=PaginationParams(1, 10),
        )

        assert count == 1
        assert [t.id for t in results] == [mine.id]

    @pytest.mark.auth
    async def test_ordered_by_last_activity(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user: User,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        older = await _create_thread(save_fixture, organization, user=user)
        newer = await _create_thread(save_fixture, organization, user=user)
        older.modified_at = utc_now() + timedelta(minutes=5)
        await save_fixture(older)

        results, _ = await compass_thread_service.list(
            session,
            auth_subject,
            organization_id=organization.id,
            pagination=PaginationParams(1, 10),
        )

        assert [t.id for t in results] == [older.id, newer.id]


@pytest.mark.asyncio
class TestRecordTurn:
    @pytest.mark.auth
    async def test_appends_message_and_touches_thread(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user)
        parts = [{"kind": "text", "text": "MRR is up 12%."}]

        message = await compass_thread_service.record_turn(
            session,
            thread.id,
            prompt="How is my MRR?",
            parts=parts,
            model_messages=_turn_model_messages("How is my MRR?", "MRR is up 12%."),
        )

        assert message is not None
        assert message.thread_id == thread.id
        assert message.parts == parts
        assert thread.modified_at is not None

    @pytest.mark.auth
    async def test_vanished_thread_records_nothing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user)
        thread.set_deleted_at()
        await save_fixture(thread)

        message = await compass_thread_service.record_turn(
            session, thread.id, prompt="hi", parts=[], model_messages=[]
        )

        assert message is None


@pytest.mark.asyncio
class TestListMessages:
    @pytest.mark.auth
    async def test_returns_turns_oldest_first(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user)
        now = utc_now()
        for turn, prompt in enumerate(["first?", "second?"]):
            await save_fixture(
                CompassThreadMessage(
                    thread=thread,
                    prompt=prompt,
                    parts=[],
                    model_messages=[],
                    created_at=now + timedelta(seconds=turn),
                )
            )

        messages, count = await compass_thread_service.list_messages(
            session, thread, pagination=PaginationParams(1, 10)
        )

        assert [message.prompt for message in messages] == ["first?", "second?"]
        assert count == 2

    @pytest.mark.auth
    async def test_first_page_is_the_most_recent_turns(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user)
        await _create_messages(save_fixture, thread, 5)

        messages, count = await compass_thread_service.list_messages(
            session, thread, pagination=PaginationParams(1, 2)
        )

        assert [message.prompt for message in messages] == ["q3", "q4"]
        assert count == 5

    @pytest.mark.auth
    async def test_later_pages_walk_back_through_older_turns(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user)
        await _create_messages(save_fixture, thread, 5)

        second, _ = await compass_thread_service.list_messages(
            session, thread, pagination=PaginationParams(2, 2)
        )
        third, _ = await compass_thread_service.list_messages(
            session, thread, pagination=PaginationParams(3, 2)
        )

        assert [message.prompt for message in second] == ["q1", "q2"]
        assert [message.prompt for message in third] == ["q0"]


@pytest.mark.asyncio
class TestBuildMessageHistory:
    @pytest.mark.auth
    async def test_no_messages_is_no_history(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user: User,
        organization: Organization,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user)

        history, last_at = await compass_thread_service.build_message_history(
            session, thread, timezone=UTC
        )

        assert history is None
        assert last_at is None

    @pytest.mark.auth
    async def test_concatenates_turns_in_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user: User,
        organization: Organization,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user)
        now = utc_now()
        for turn, (prompt, answer) in enumerate(
            [("first?", "one"), ("second?", "two")]
        ):
            await save_fixture(
                CompassThreadMessage(
                    thread=thread,
                    prompt=prompt,
                    parts=[],
                    model_messages=_turn_model_messages(prompt, answer),
                    created_at=now + timedelta(seconds=turn),
                )
            )

        history, last_at = await compass_thread_service.build_message_history(
            session, thread, timezone=UTC
        )

        assert history is not None
        assert len(history) == 4
        assert last_at == now + timedelta(seconds=1)
        first_request = history[0]
        assert isinstance(first_request, ModelRequest)
        first_part = first_request.parts[0]
        assert isinstance(first_part, UserPromptPart)
        assert first_part.content == "first?"

    @pytest.mark.auth
    async def test_replays_only_recent_turns(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user: User,
        organization: Organization,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user)
        now = utc_now()
        total = HISTORY_TURNS + 2
        for turn in range(total):
            await save_fixture(
                CompassThreadMessage(
                    thread=thread,
                    prompt=f"q{turn}",
                    parts=[],
                    model_messages=_turn_model_messages(f"q{turn}", f"a{turn}"),
                    created_at=now + timedelta(seconds=turn),
                )
            )

        history, _ = await compass_thread_service.build_message_history(
            session, thread, timezone=UTC
        )

        assert history is not None
        assert len(history) == HISTORY_TURNS * 2
        oldest_replayed = history[0]
        assert isinstance(oldest_replayed, ModelRequest)
        oldest_part = oldest_replayed.parts[0]
        assert isinstance(oldest_part, UserPromptPart)
        assert oldest_part.content == "q2"

    @pytest.mark.auth
    async def test_invalid_stored_history_degrades_to_fresh_context(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user: User,
        organization: Organization,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user)
        await save_fixture(
            CompassThreadMessage(
                thread=thread,
                prompt="hi",
                parts=[],
                model_messages=[{"bogus": True}],
            )
        )

        history, last_at = await compass_thread_service.build_message_history(
            session, thread, timezone=UTC
        )

        assert history is None
        assert last_at is None

    @pytest.mark.auth
    async def test_stamps_each_turn_tool_results_with_its_local_fetch_date(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user: User,
        organization: Organization,
    ) -> None:
        """The model only sees tool result content, so the fetch date has to be
        in it for the staleness rule to be applicable. The second turn ran late
        in the merchant's day: it is stamped with that local day, not the UTC
        one it rolled over into."""
        thread = await _create_thread(save_fixture, organization, user=user)
        for created_at, revenue in [
            (datetime(2026, 8, 4, 12, 0, tzinfo=UTC), "$100.00"),
            (datetime(2026, 8, 6, 2, 0, tzinfo=UTC), "$180.00"),
        ]:
            await save_fixture(
                CompassThreadMessage(
                    thread=thread,
                    prompt="revenue?",
                    parts=[],
                    model_messages=_turn_with_tool_call("revenue?", revenue, "ok"),
                    created_at=created_at,
                )
            )

        history, _ = await compass_thread_service.build_message_history(
            session,
            thread,
            timezone=ZoneInfo("America/Los_Angeles"),
        )

        assert history is not None
        assert _tool_results(history) == [
            "[fetched 2026-08-04] $100.00",
            "[fetched 2026-08-05] $180.00",
        ]


@pytest.mark.asyncio
class TestGet:
    @pytest.mark.auth
    async def test_own_thread_is_readable(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user: User,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user)

        found = await compass_thread_service.get(session, auth_subject, thread.id)

        assert found is not None
        assert found.id == thread.id

    @pytest.mark.auth
    async def test_another_users_thread_is_not_found(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user_second: User,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user_second)

        assert (
            await compass_thread_service.get(session, auth_subject, thread.id) is None
        )
