import pytest
from pytest_mock import MockerFixture

from polar.config import Environment, settings
from polar.observability.invariants.rules.base import Invariant, InvariantError
from polar.observability.invariants.service import invariant as invariant_service
from polar.postgres import AsyncSession


class _AllEnvironmentsInvariant(Invariant):
    ENVIRONMENTS = None

    async def check(self) -> None:
        raise InvariantError(type(self), "always fails")


class _ProductionOnlyInvariant(Invariant):
    ENVIRONMENTS = {Environment.production}

    async def check(self) -> None:
        raise InvariantError(type(self), "always fails")


@pytest.mark.asyncio
async def test_skips_invariant_outside_its_environments(
    session: AsyncSession, mocker: MockerFixture
) -> None:
    mocker.patch.object(settings, "ENV", Environment.sandbox)
    check_spy = mocker.spy(_ProductionOnlyInvariant, "check")

    await invariant_service.check(session, _ProductionOnlyInvariant)

    check_spy.assert_not_called()


@pytest.mark.asyncio
async def test_runs_invariant_within_its_environments(
    session: AsyncSession, mocker: MockerFixture
) -> None:
    mocker.patch.object(settings, "ENV", Environment.production)
    mocker.patch.object(invariant_service._slack, "chat_post_message")
    check_spy = mocker.spy(_ProductionOnlyInvariant, "check")

    await invariant_service.check(session, _ProductionOnlyInvariant)

    check_spy.assert_called_once()


@pytest.mark.asyncio
async def test_runs_invariant_with_no_environment_restriction(
    session: AsyncSession, mocker: MockerFixture
) -> None:
    mocker.patch.object(settings, "ENV", Environment.sandbox)
    mocker.patch.object(invariant_service._slack, "chat_post_message")
    check_spy = mocker.spy(_AllEnvironmentsInvariant, "check")

    await invariant_service.check(session, _AllEnvironmentsInvariant)

    check_spy.assert_called_once()
