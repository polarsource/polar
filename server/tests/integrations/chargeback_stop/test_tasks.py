import uuid
from collections.abc import Awaitable, Callable
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from polar.dispute.service import DisputeAlertTransactionNotLinkedError
from polar.integrations.chargeback_stop.tasks import alert_created, alert_updated


@pytest.mark.anyio
@pytest.mark.parametrize("task", [alert_created, alert_updated])
async def test_unlinked_transaction_is_swallowed(
    task: Callable[[uuid.UUID], Awaitable[None]], mocker: MockerFixture
) -> None:
    event_mock = mocker.MagicMock()
    context_mock = mocker.patch(
        "polar.integrations.chargeback_stop.tasks.external_event_service.handle"
    )
    context_mock.return_value.__aenter__ = AsyncMock(return_value=event_mock)
    context_mock.return_value.__aexit__ = AsyncMock(return_value=None)
    error = DisputeAlertTransactionNotLinkedError("CHARGEBACK_STOP_ALERT_ID")
    mocker.patch(
        "polar.integrations.chargeback_stop.tasks.dispute_service.upsert_from_chargeback_stop",
        side_effect=error,
    )
    capture_exception_mock = mocker.patch(
        "polar.integrations.chargeback_stop.tasks.sentry_sdk.capture_exception"
    )

    await task(uuid.uuid4())

    capture_exception_mock.assert_called_once_with(error)
