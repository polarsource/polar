import json
from unittest.mock import Mock

import httpx2
import pytest

from polar.integrations.payment_retry_alert.client import PaymentRetryAlertClient
from polar.integrations.payment_retry_alert.types import RetryOutcome


@pytest.mark.anyio
class TestUpdateRetryOutcome:
    async def test_sends_outcome_and_version_header(
        self, http_mocks: dict[tuple[str, str], Mock]
    ) -> None:
        handler = Mock(return_value=httpx2.Response(200, json={}))
        url = "https://api.paymentretryalert.com/v1/alerts/alrt_test"
        http_mocks["PATCH", url] = handler

        await PaymentRetryAlertClient().update_retry_outcome(
            "alrt_test", RetryOutcome.succeeded
        )

        request: httpx2.Request = handler.call_args.args[0]
        assert json.loads(request.content) == {"retry_outcome": "SUCCEEDED"}
        assert request.headers["PaymentRetryAlert-Version"] == "2026-10-05"
