import json
from unittest.mock import Mock

import httpx2
import pytest

from polar.integrations.payment_retry_alert.client import (
    PaymentRetryAlertAPIError,
    PaymentRetryAlertClient,
)
from polar.integrations.payment_retry_alert.types import RetryOutcome

ALERT_URL = "https://api.paymentretryalert.com/v1/alerts/alrt_test"


@pytest.mark.anyio
class TestUpdateRetryOutcome:
    async def test_valid(self, http_mocks: dict[tuple[str, str], Mock]) -> None:
        handler = Mock(return_value=httpx2.Response(200, json={}))
        http_mocks["PATCH", ALERT_URL] = handler

        await PaymentRetryAlertClient().update_retry_outcome(
            "alrt_test", RetryOutcome.succeeded
        )

        request: httpx2.Request = handler.call_args.args[0]
        assert json.loads(request.content) == {"retry_outcome": "SUCCEEDED"}
        assert request.headers["PaymentRetryAlert-Version"] == "2026-10-05"

    async def test_error(self, http_mocks: dict[tuple[str, str], Mock]) -> None:
        http_mocks["PATCH", ALERT_URL] = Mock(return_value=httpx2.Response(404))

        with pytest.raises(PaymentRetryAlertAPIError) as exc_info:
            await PaymentRetryAlertClient().update_retry_outcome(
                "alrt_test", RetryOutcome.failed
            )

        assert exc_info.value.response_status_code == 404
