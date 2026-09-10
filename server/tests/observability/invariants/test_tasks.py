import contextlib
from collections.abc import AsyncIterator
from typing import Any

import pytest
from pytest_mock import MockerFixture

from polar.observability.invariants import tasks
from polar.observability.invariants.rules.base import InvariantError
from polar.observability.invariants.rules.subscriptions_canceled_deleted_customer import (
    SubscriptionsCanceledDeletedCustomerInvariant,
)
from polar.observability.invariants.service import invariant as invariant_service

_check_invariant = tasks.check_invariant.__wrapped__  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_notifies_after_database_session_closes(
    mocker: MockerFixture,
) -> None:
    events: list[str] = []
    session = mocker.Mock()

    @contextlib.asynccontextmanager
    async def sessionmaker() -> AsyncIterator[Any]:
        events.append("session_opened")
        yield session
        events.append("session_closed")

    invariant_error = InvariantError(
        SubscriptionsCanceledDeletedCustomerInvariant,
        "always fails",
    )
    mocker.patch.object(tasks, "AsyncReadSessionMaker", sessionmaker)
    mocker.patch.object(
        invariant_service,
        "check",
        return_value=invariant_error,
    )

    async def notify(_: InvariantError) -> None:
        events.append("notified")

    mocker.patch.object(invariant_service, "notify", side_effect=notify)

    invariant_identifier = (
        f"{SubscriptionsCanceledDeletedCustomerInvariant.__module__}."
        f"{SubscriptionsCanceledDeletedCustomerInvariant.__qualname__}"
    )
    await _check_invariant(invariant_identifier)

    assert events == ["session_opened", "session_closed", "notified"]
