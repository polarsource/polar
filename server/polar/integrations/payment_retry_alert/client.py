from urllib.parse import quote

import httpx2

from polar.config import settings
from polar.exceptions import PolarError

from .types import RetryOutcome

API_VERSION = "2026-10-05"


class PaymentRetryAlertAPIError(PolarError):
    def __init__(self, response_status_code: int) -> None:
        self.response_status_code = response_status_code
        super().__init__(
            f"PaymentRetryAlert API request failed with status {response_status_code}"
        )

    @property
    def is_retryable(self) -> bool:
        return self.response_status_code == 429 or self.response_status_code >= 500


class PaymentRetryAlertClient:
    def _get_client(self) -> httpx2.AsyncClient:
        return httpx2.AsyncClient(
            base_url=settings.PAYMENT_RETRY_ALERT_API_BASE_URL,
            headers={
                "Authorization": f"Bearer {settings.PAYMENT_RETRY_ALERT_API_KEY}",
                "PaymentRetryAlert-Version": API_VERSION,
            },
        )

    async def update_retry_outcome(self, alert_id: str, outcome: RetryOutcome) -> None:
        async with self._get_client() as client:
            response = await client.patch(
                f"/alerts/{quote(alert_id, safe='')}",
                json={"retry_outcome": outcome},
            )
        if not response.is_success:
            raise PaymentRetryAlertAPIError(response.status_code)


client = PaymentRetryAlertClient()
