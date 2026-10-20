# Polar Python SDK

The official Python client for the [Polar API](https://polar.sh/docs/api-reference).

## Installation

The SDK requires Python 3.11 or later.

To install it with `uv`:

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
from polar.v2026_10 import Polar

polar = Polar("polar_oat_xxx")

customer_state = polar.customers.get_state_external("customer_external_id")
print(customer_state)
```

### Async Client

Use `PolarAsync` in asynchronous applications:

```python
import asyncio

from polar.v2026_10 import PolarAsync


async def main() -> None:
    polar = PolarAsync("polar_oat_xxx")
    customer_state = await polar.customers.get_state_external("customer_external_id")
    print(customer_state)


asyncio.run(main())
```

## Context Managers

Both clients support context managers to close their HTTP connections automatically when the
block exits.

For synchronous applications, use `Polar` with `with`:

```python
from polar.v2026_10 import Polar

with Polar("polar_oat_xxx") as polar:
    customer_state = polar.customers.get_state_external("customer_external_id")
    print(customer_state)
```

For asynchronous applications, use `PolarAsync` with `async with`:

```python
import asyncio

from polar.v2026_10 import PolarAsync


async def main() -> None:
    async with PolarAsync("polar_oat_xxx") as polar:
        customer_state = await polar.customers.get_state_external(
            "customer_external_id"
        )
        print(customer_state)


asyncio.run(main())
```

The client uses the production environment by default. To use the sandbox, pass
`environment="sandbox"` when creating the client. Sandbox and production access tokens are
separate.

Keep organization access tokens on the server and never expose them in browser or client-side
code.

## Request Timeouts

Set the default timeout for all requests when creating the client. Timeout values are expressed
in seconds:

```python
polar = Polar("polar_oat_xxx", timeout=30)
```

Override the timeout for an individual request with `request_timeout`:

```python
customer_state = polar.customers.get_state_external(
    "customer_external_id",
    request_timeout=60,
)
```

Override the access token for an individual request with `request_access_token`:

```python
customer_state = polar.customers.get_state_external(
    "customer_external_id",
    request_access_token="polar_at_u_override",
)
```

Pass an `httpx.Timeout` instance to configure connect, read, write, and pool timeouts separately.

## Organizations

OAuth access tokens and personal access tokens can reach every organization the user belongs to.
Pass `organization_id` to get a client that acts on a single organization. It sends the
`Polar-Organization` header, so the API only returns and changes that organization's data:

```python
acme = Polar("polar_at_u_xxx", organization_id="acme_organization_id")
customers = acme.customers.list()
```

Organization access tokens already act on their own organization and don't need it.

## Deserializing Data

Use `deserialize` to convert arbitrary data into a generated SDK model or union type:

```python
from polar import deserialize
from polar.v2026_10.outputs import Customer

customer = deserialize(data, Customer)
```

## Metering

The metering helper adds buffering, batching, and optional local reduction to the Polar Event Ingestion API.

### Basic usage

```python
from polar.v2026_10 import PolarAsync


async def record_usage() -> None:
    async with PolarAsync("polar_oat_xxx") as polar:
        async with polar.metering() as metering:
            await metering.track(
                name="api_request",
                external_customer_id="customer_123",
                metadata={"tokens": 42},
            )
```

### Actor context

It's common to have several events for the same customer in the same session. You can create an actor context, so you don't have to pass the customer identifier for each event:

```python
async with polar.metering() as metering:
    actor = await metering.actor(external_customer_id="customer_123")
    await actor.track(name="api_request", metadata={"tokens": 42})
    await actor.track(name="api_request", metadata={"tokens": 17})
```

### Read meters

The metering helper can read meters. Under the hood, it can leverage Outpost to have low-latency reads.

```python
meter = await metering.meter("meter_uuid", external_customer_id="customer_123")
```

With an actor context:

```python
actor = await metering.actor(external_customer_id="customer_123")
meter = await actor.meter("meter_uuid")
```

### Local reduction with Outpost

Outpost is our local reduction engine. It can reduce events locally and share a state across all your clients via Redis. It's enabled automatically when you set the `REDIS_URL` environment variable.

In high throughput scenarios, Outpost can return you accurate meter reads only milliseconds after the event is ingested.

To disable it, pass `outpost=False` to `polar.metering()`. You can also configure it explicitly with a dictionary.

### Serverless environments

In serverless environments such as AWS Lambda or Vercel, background work may stop when the
handler returns. Explicitly await `flush()` before returning so buffered events are processed
while the invocation is still active.

```python
async def handle_request() -> dict[str, bool]:
    await metering.track(name="api_request", external_customer_id="customer_123")
    await metering.flush()
    return {"ok": True}
```

### Options

#### Buffered

The metering helper buffers events in memory and sends them in batches to Polar. It retries network errors, rate limits, and server errors with exponential backoff and jitter. Other Polar API errors drop the batch without retrying.

| Option             | Default | Meaning                                                    |
| ------------------ | ------- | ---------------------------------------------------------- |
| `batch_size`       | `100`   | Maximum events per HTTP request.                           |
| `batch_interval`   | `1.0`   | Seconds to collect a batch, starting with its first event. |
| `shutdown_timeout` | `5.0`   | Seconds allowed to drain on context exit.                  |
| `max_attempts`     | `3`     | Total attempts per batch, including the first.             |
| `on_dropped`       | `None`  | Async callback receiving the dropped events and reason.    |

#### Outpost

| Option      | Default                          | Meaning                                   |
| ----------- | -------------------------------- | ----------------------------------------- |
| `redis_url` | `REDIS_URL` environment variable | Redis instance used by Outpost.           |
| `telemetry` | `True`                           | Send Outpost metrics and traces to Polar. |

Telemetry can also be disabled with the `POLAR_OUTPOST_TELEMETRY=0` environment variable.

## Webhooks

Use `validate_event` to verify that a webhook was sent by Polar and parse it into a typed payload
for the selected API version. Pass the raw request body, the request headers, and your webhook
signing secret:

```python
import os

from fastapi import FastAPI, HTTPException, Request

from polar.v2026_10.webhooks import (
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
        raise HTTPException(
            status_code=403, detail="Invalid webhook signature"
        ) from exc
    except PolarWebhookError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from exc

    if event.type == "order.created":
        print(event.data.id)

    return {"received": True}
```

The signature is checked before the body is parsed. Verification accepts Polar's
original HMAC key (UTF-8 bytes of the full secret, including `whsec_`) and the
Standard Webhooks key (base64-decode of the remainder after `whsec_`).
`validate_event` raises `PolarWebhookVerificationError` for invalid signatures and
`PolarWebhookUnknownTypeError` when the event is not supported by the selected API
version. Both inherit from `PolarWebhookError`.