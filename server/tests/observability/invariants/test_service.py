import uuid
from decimal import Decimal
from typing import Any, ClassVar

import pytest
from pytest_mock import MockerFixture

from polar.config import Environment, settings
from polar.observability.invariants.rules.base import Invariant, InvariantError
from polar.observability.invariants.service import invariant as invariant_service
from polar.postgres import AsyncSession
from polar.redis import Redis


class _AllEnvironmentsInvariant(Invariant):
    ENVIRONMENTS = None

    async def check(self) -> None:
        raise InvariantError(type(self), "always fails")


class _ProductionOnlyInvariant(Invariant):
    ENVIRONMENTS = {Environment.production}

    async def check(self) -> None:
        raise InvariantError(type(self), "always fails")


class _DecimalContextInvariant(Invariant):
    ENVIRONMENTS = None

    async def check(self) -> None:
        raise InvariantError(
            type(self),
            "always fails",
            {"differences": [Decimal(1234)], "ids": [uuid.uuid4()]},
        )


class _ToggleInvariant(Invariant):
    ENVIRONMENTS = None
    context: ClassVar[dict[str, Any] | None] = None

    async def check(self) -> None:
        if self.context is not None:
            raise InvariantError(type(self), "fails", self.context)


@pytest.fixture
def slack_configured(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.sandbox)
    mocker.patch.object(settings, "SLACK_BOT_TOKEN", "token")
    mocker.patch.object(settings, "SLACK_CHANNEL", "channel")


@pytest.mark.asyncio
class TestCheck:
    async def test_skips_invariant_outside_its_environments(
        self, session: AsyncSession, redis: Redis, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(settings, "ENV", Environment.sandbox)
        check_spy = mocker.spy(_ProductionOnlyInvariant, "check")

        await invariant_service.check(session, redis, _ProductionOnlyInvariant)

        check_spy.assert_not_called()

    async def test_runs_invariant_within_its_environments(
        self, session: AsyncSession, redis: Redis, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(settings, "ENV", Environment.production)
        mocker.patch(
            "polar.observability.invariants.service.slack_client.chat_post_message"
        )
        check_spy = mocker.spy(_ProductionOnlyInvariant, "check")

        await invariant_service.check(session, redis, _ProductionOnlyInvariant)

        check_spy.assert_called_once()

    async def test_runs_invariant_with_no_environment_restriction(
        self, session: AsyncSession, redis: Redis, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(settings, "ENV", Environment.sandbox)
        mocker.patch(
            "polar.observability.invariants.service.slack_client.chat_post_message"
        )
        check_spy = mocker.spy(_AllEnvironmentsInvariant, "check")

        await invariant_service.check(session, redis, _AllEnvironmentsInvariant)

        check_spy.assert_called_once()

    @pytest.mark.usefixtures("slack_configured")
    async def test_notifies_when_context_is_not_natively_serializable(
        self, session: AsyncSession, redis: Redis, mocker: MockerFixture
    ) -> None:
        post_message_mock = mocker.patch(
            "polar.observability.invariants.service.slack_client.chat_post_message",
            return_value={"ok": True, "ts": "1.0"},
        )

        await invariant_service.check(session, redis, _DecimalContextInvariant)

        post_message_mock.assert_called_once()
        assert "1234" in str(post_message_mock.call_args.kwargs["blocks"])

    @pytest.mark.usefixtures("slack_configured")
    async def test_first_failure_posts_new_message(
        self, session: AsyncSession, redis: Redis, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(_ToggleInvariant, "context", {"ids": ["a"]})
        post_message_mock = mocker.patch(
            "polar.observability.invariants.service.slack_client.chat_post_message",
            return_value={"ok": True, "ts": "1.0"},
        )

        await invariant_service.check(session, redis, _ToggleInvariant)

        post_message_mock.assert_called_once()
        assert "thread_ts" not in post_message_mock.call_args.kwargs
        keys = await redis.keys("observability:invariants:alert:*")
        assert len(keys) == 1
        assert 23 * 3600 < await redis.ttl(keys[0]) <= 24 * 3600

    @pytest.mark.usefixtures("slack_configured")
    async def test_same_failure_is_not_posted_again(
        self, session: AsyncSession, redis: Redis, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(_ToggleInvariant, "context", {"ids": ["a"]})
        post_message_mock = mocker.patch(
            "polar.observability.invariants.service.slack_client.chat_post_message",
            return_value={"ok": True, "ts": "1.0"},
        )

        await invariant_service.check(session, redis, _ToggleInvariant)
        await invariant_service.check(session, redis, _ToggleInvariant)

        post_message_mock.assert_called_once()

    @pytest.mark.usefixtures("slack_configured")
    async def test_changed_failure_replies_in_thread(
        self, session: AsyncSession, redis: Redis, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(_ToggleInvariant, "context", {"ids": ["a"]})
        post_message_mock = mocker.patch(
            "polar.observability.invariants.service.slack_client.chat_post_message",
            side_effect=[{"ok": True, "ts": "1.0"}, {"ok": True, "ts": "2.0"}],
        )

        await invariant_service.check(session, redis, _ToggleInvariant)
        mocker.patch.object(_ToggleInvariant, "context", {"ids": ["a", "b"]})
        await invariant_service.check(session, redis, _ToggleInvariant)
        await invariant_service.check(session, redis, _ToggleInvariant)

        assert post_message_mock.call_count == 2
        assert post_message_mock.call_args.kwargs["thread_ts"] == "1.0"
        keys = await redis.keys("observability:invariants:alert:*")
        assert await redis.ttl(keys[0]) > 0

    @pytest.mark.usefixtures("slack_configured")
    async def test_resolved_failure_replies_in_thread(
        self, session: AsyncSession, redis: Redis, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(_ToggleInvariant, "context", {"ids": ["a"]})
        post_message_mock = mocker.patch(
            "polar.observability.invariants.service.slack_client.chat_post_message",
            return_value={"ok": True, "ts": "1.0"},
        )

        await invariant_service.check(session, redis, _ToggleInvariant)
        mocker.patch.object(_ToggleInvariant, "context", None)
        await invariant_service.check(session, redis, _ToggleInvariant)
        await invariant_service.check(session, redis, _ToggleInvariant)

        assert post_message_mock.call_count == 2
        assert post_message_mock.call_args.kwargs["thread_ts"] == "1.0"
        assert "passes again" in post_message_mock.call_args.kwargs["text"]

    @pytest.mark.usefixtures("slack_configured")
    async def test_failure_after_resolution_posts_new_message(
        self, session: AsyncSession, redis: Redis, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(_ToggleInvariant, "context", {"ids": ["a"]})
        post_message_mock = mocker.patch(
            "polar.observability.invariants.service.slack_client.chat_post_message",
            return_value={"ok": True, "ts": "1.0"},
        )

        await invariant_service.check(session, redis, _ToggleInvariant)
        mocker.patch.object(_ToggleInvariant, "context", None)
        await invariant_service.check(session, redis, _ToggleInvariant)
        mocker.patch.object(_ToggleInvariant, "context", {"ids": ["a"]})
        await invariant_service.check(session, redis, _ToggleInvariant)

        assert post_message_mock.call_count == 3
        assert "thread_ts" not in post_message_mock.call_args.kwargs

    @pytest.mark.usefixtures("slack_configured")
    async def test_passing_without_previous_failure_posts_nothing(
        self, session: AsyncSession, redis: Redis, mocker: MockerFixture
    ) -> None:
        post_message_mock = mocker.patch(
            "polar.observability.invariants.service.slack_client.chat_post_message"
        )

        await invariant_service.check(session, redis, _ToggleInvariant)

        post_message_mock.assert_not_called()
