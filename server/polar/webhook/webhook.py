import datetime
from typing import Any

from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.kit.utils import utc_now


class WebhookEvent:
    # ID of the webhook. Generated when the event is created, and is consistent between retries.
    id: str

    # Timestamp of when the webhook is sent. Changes on each retry. Is used to prevent replay attacks.
    ts: datetime.datetime

    # JSON-encoded
    data: Any

    secret: str

    def __init__(self, *, id: str, data: Any, secret: str) -> None:
        self.id = id
        self.ts = utc_now()
        self.data = data
        self.secret = secret

    def headers(self) -> dict[str, str]:
        wh = StandardWebhook(self.secret)
        signature = wh.sign(self.id, self.ts, self.data)

        return {
            "webhook-id": self.id,
            "webhook-timestamp": str(self.ts.timestamp()),
            "webhook-signature": signature,
        }
