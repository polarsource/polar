from datetime import timedelta
from typing import Any

import pytest
from pydantic import ValidationError
from pytest_mock import MockerFixture

from polar.exceptions import ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import Organization
from polar.postgres import AsyncSession
from polar.void.deploy.repository import DeployRepository
from polar.void.judge.schemas import JudgeRequest, JudgeWindow
from polar.void.judge.service import MIN_INTERVAL, JudgeService
from polar.void.typesafe import TypeSafeError
from tests.void.conftest import VERSION

from .conftest import WHEN, FixedJudge, Tree, completion, ingest

REQUEST = JudgeRequest(meter="tokens", when=WHEN)


def test_request_requires_a_signal_or_inline_criteria() -> None:
    JudgeRequest(signal="abuse")
    JudgeRequest(meter="tokens", when=WHEN)
    with pytest.raises(ValidationError):
        JudgeRequest(meter="tokens")
    with pytest.raises(ValidationError):
        JudgeRequest()


class Boom:
    async def judge(self, state: Any, when: str) -> Any:
        raise TypeSafeError("down")


@pytest.mark.asyncio
class TestJudge:
    async def test_asks_once_per_state_and_rolls_children_up(
        self, session: AsyncSession, organization: Organization, tree: Tree
    ) -> None:
        await ingest(
            session,
            organization,
            completion("e1", minutes_ago=30),
            completion("e2", minutes_ago=2, tool_errors=["deploy"]),
            completion("old", minutes_ago=90),
            completion("other", minutes_ago=1, name="sandbox.stopped"),
        )
        jev = FixedJudge()
        service = JudgeService(jev)
        first = await service.judge(session, organization.id, "root", REQUEST, VERSION)
        assert first.noul == 0.81
        assert first.model == "jev-test"
        assert first.stale is False
        assert first.root_id == "root"
        assert first.evidence.events == 2
        assert first.evidence.identities == 1
        assert first.evidence.totals["cost"] == pytest.approx(0.04)
        assert first.evidence.values["tool_errors"] == ["deploy"]
        assert [row["id"] for row in first.evidence.sample] == ["e1", "e2"]
        assert first.evidence.sample[1]["gap_ms"] > 0
        assert jev.calls == 1
        assert jev.states[0]["meter"]["slug"] == "tokens"
        assert jev.states[0]["evidence"]["events"] == 2

        second = await service.judge(session, organization.id, "root", REQUEST, VERSION)
        assert second.noul == 0.81
        assert second.stale is False
        assert jev.calls == 1

    async def test_empty_window_is_free_and_zero(
        self, session: AsyncSession, organization: Organization, tree: Tree
    ) -> None:
        jev = FixedJudge()
        result = await JudgeService(jev).judge(
            session, organization.id, "child", REQUEST, VERSION
        )
        assert result.noul == 0.0
        assert result.model is None
        assert result.evidence.events == 0
        assert jev.calls == 0

    async def test_new_events_within_a_minute_return_the_stale_noul(
        self,
        session: AsyncSession,
        organization: Organization,
        tree: Tree,
        mocker: MockerFixture,
    ) -> None:
        await ingest(session, organization, completion("e1"))
        jev = FixedJudge(0.3)
        service = JudgeService(jev)
        first = await service.judge(session, organization.id, "root", REQUEST, VERSION)
        assert first.noul == 0.3
        await ingest(session, organization, completion("e2", minutes_ago=1))
        second = await service.judge(session, organization.id, "root", REQUEST, VERSION)
        assert second.noul == 0.3
        assert second.stale is True
        assert second.evidence.events == 1
        assert jev.calls == 1

        later = utc_now() + MIN_INTERVAL + timedelta(seconds=1)
        mocker.patch("polar.void.judge.service.utc_now", return_value=later)
        jev.noul = 0.9
        third = await service.judge(session, organization.id, "root", REQUEST, VERSION)
        assert third.noul == 0.9
        assert third.stale is False
        assert third.evidence.events == 2
        assert jev.calls == 2

    async def test_jev_down_is_unknown_then_keeps_the_last_answer(
        self,
        session: AsyncSession,
        organization: Organization,
        tree: Tree,
        mocker: MockerFixture,
    ) -> None:
        await ingest(session, organization, completion("e1"))
        down = await JudgeService(Boom()).judge(
            session, organization.id, "root", REQUEST, VERSION
        )
        assert down.noul is None
        assert down.judged_at is None
        assert down.stale is False

        later = utc_now() + MIN_INTERVAL + timedelta(seconds=1)
        mocker.patch("polar.void.judge.service.utc_now", return_value=later)
        judged = await JudgeService(FixedJudge(0.6)).judge(
            session, organization.id, "root", REQUEST, VERSION
        )
        assert judged.noul == 0.6

        await ingest(session, organization, completion("e2", minutes_ago=1))
        much_later = later + MIN_INTERVAL + timedelta(seconds=1)
        mocker.patch("polar.void.judge.service.utc_now", return_value=much_later)
        kept = await JudgeService(Boom()).judge(
            session, organization.id, "root", REQUEST, VERSION
        )
        assert kept.noul == 0.6
        assert kept.stale is True

    async def test_questions_are_cached_apart(
        self, session: AsyncSession, organization: Organization, tree: Tree
    ) -> None:
        await ingest(session, organization, completion("e1"))
        jev = FixedJudge()
        service = JudgeService(jev)
        await service.judge(session, organization.id, "root", REQUEST, VERSION)
        await service.judge(
            session,
            organization.id,
            "root",
            JudgeRequest(
                meter="tokens", when=WHEN, over=JudgeWindow(amount=1, unit="day")
            ),
            VERSION,
        )
        assert jev.calls == 2

    async def test_unknown_meter_or_version(
        self, session: AsyncSession, organization: Organization, tree: Tree
    ) -> None:
        service = JudgeService(FixedJudge())
        with pytest.raises(ResourceNotFound):
            await service.judge(
                session,
                organization.id,
                "root",
                JudgeRequest(meter="missing", when=WHEN),
                VERSION,
            )
        with pytest.raises(ResourceNotFound):
            await service.judge(session, organization.id, "root", REQUEST, None)


@pytest.mark.asyncio
class TestSignalResolution:
    async def _deploy_signal(
        self, session: AsyncSession, organization: Organization, **signal: Any
    ) -> None:
        deployment = await DeployRepository.from_session(session).active(
            organization.id
        )
        assert deployment is not None
        deployment.configuration = {
            **(deployment.configuration or {}),
            "signals": [
                {
                    "slug": "abuse",
                    "kind": "semantic",
                    "meter": "tokens",
                    "when": WHEN,
                    "over": {"amount": 1, "unit": "hour"},
                    "enter_above": 0.8,
                    "exit_below": 0.4,
                    **signal,
                }
            ],
        }
        await session.flush()

    async def test_resolves_criteria_from_the_deployed_signal(
        self, session: AsyncSession, organization: Organization, tree: Tree
    ) -> None:
        await self._deploy_signal(session, organization)
        await ingest(session, organization, completion("e1", minutes_ago=2))
        jev = FixedJudge()
        result = await JudgeService(jev).judge(
            session,
            organization.id,
            "root",
            JudgeRequest(signal="abuse"),
            VERSION,
        )
        assert result.meter == "tokens"
        assert result.when == WHEN
        assert result.noul == 0.81
        assert jev.calls == 1

    async def test_unknown_signal_is_not_found(
        self, session: AsyncSession, organization: Organization, tree: Tree
    ) -> None:
        await self._deploy_signal(session, organization)
        with pytest.raises(ResourceNotFound):
            await JudgeService(FixedJudge()).judge(
                session,
                organization.id,
                "root",
                JudgeRequest(signal="ghost"),
                VERSION,
            )
