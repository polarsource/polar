# Polar Python SDK

The official Python client for the [Polar API](https://polar.sh/docs/api-reference).

## Installation

The SDK requires Python 3.11 or later.

```bash
uv add polar-sdk
```

or, with `pip`:

```bash
pip install polar-sdk
```

## Quick Start

Create an [organization access token](https://polar.sh/docs/integrate/oat) and use the client for
the current API version:

```python
from polar.v2026_04 import Polar

polar = Polar("polar_oat_xxx")

customer_state = polar.customers.get_state_external("customer_external_id")
print(customer_state)
```

The client uses the production environment by default. To use the sandbox, pass
`environment="sandbox"` when creating the client. Sandbox and production access tokens are
separate.

Keep organization access tokens on the server and never expose them in browser or client-side
code.

## Webhooks

Use `validate_event` to verify that a webhook was sent by Polar and parse it into a typed payload
for the selected API version. Pass the raw request body, the request headers, and your webhook
signing secret:

```python
import os

from fastapi import FastAPI, HTTPException, Request

from polar.v2026_04.webhooks import (
    PolarWebhookError,
    PolarWebhookVerificationError,
    validate_event,
)

app = FastAPI()
webhook_secret = os.environ["POLAR_WEBHOOK_SECRET"]


@app.post("/webhooks/polar")
async def polar_webhook(request: Request) -> dict[str, bool]:
    try:
        event = validate_event(
            await request.body(),
            dict(request.headers),
            webhook_secret,
        )
    except PolarWebhookVerificationError as exc:
        raise HTTPException(status_code=403, detail="Invalid webhook signature") from exc
    except PolarWebhookError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from exc

    if event.type == "order.created":
        print(event.data.id)

    return {"received": True}
```

The signature is checked before the body is parsed. `validate_event` raises
`PolarWebhookVerificationError` for invalid signatures and `PolarWebhookUnknownTypeError` when the
event is not supported by the selected API version. Both inherit from `PolarWebhookError`.