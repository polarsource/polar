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

## Ingestion

The ingestion helper batches usage events for delivery to Polar and reads customer meters.
It is available on every version of `PolarAsync`; synchronous `Polar` clients do not expose it.

### Create the helper

```python
from polar.v2026_10 import PolarAsync


async def record_usage() -> None:
    async with PolarAsync("polar_oat_xxx") as polar:
        async with polar.ingestion() as ingestion:
            await ingestion.ingest(
                name="api_request",
                external_customer_id="customer_123",
                metadata={"tokens": 42},
            )
```

Entering the context starts the strategies; exiting closes them and drains the buffer.
Buffering is enabled by default. Outpost is also enabled when `REDIS_URL` is set; otherwise,
meter reads use Polar's HTTP API. Pass `outpost=False` to force HTTP-only operation.

### Ingest events and read meters

Use either a Polar `customer_id` or your application's `external_customer_id`, never both.
For member attribution, pair `member_id` with `customer_id`, or `external_member_id` with
`external_customer_id`.

Within the ingestion context:

```python
actor = await ingestion.actor(external_customer_id="customer_123")
await actor.ingest(name="api_request", metadata={"tokens": 42})

meter = await actor.meter("meter_uuid")
if meter is not None:
    print(meter.consumed_units, meter.credited_units, meter.balance)

# The same read without an actor helper:
meter = await ingestion.meter(
    meter_id="meter_uuid", external_customer_id="customer_123"
)

await ingestion.flush()
```

The actor automatically attaches its customer and optional member identifiers to each event.
Meter reads are customer-wide, including when the actor has a member identifier. They return
`CustomerMeter`, or `None` if no meter is found. The balance is credited units minus consumed
units and can be negative.

### Delivery and lifecycle

`ingest()` dispatches each event to the configured strategies in order. With the default
buffered strategy, it returns after queuing the event in memory, before HTTP delivery.
Keep one helper alive for the lifetime of a server or worker and close it during shutdown.
For request-scoped or serverless work, await flushing or closing within the request's active
lifetime; background work may stop when the response is returned.

Flushing waits until earlier buffered events have either been delivered or reported as dropped.
It leaves the helper open and excludes events queued after the flush marker. A successful flush
does not guarantee delivery: inspect the drop callback. Polar processes events asynchronously,
so flushing also does not guarantee an immediately updated HTTP meter read.

The buffer is unbounded and held in memory. Process termination can lose pending events.
Shutdown drains only up to the configured timeout, then reports the remaining events as dropped.
Use a drop callback to persist or otherwise handle failed batches when delivery matters.

### Serverless environments

In serverless environments such as AWS Lambda or Vercel, background work may stop when the
handler returns. Explicitly await `flush()` before returning so buffered events are processed
while the invocation is still active.

```python
async def handle_request() -> dict[str, bool]:
    await ingestion.ingest(name="api_request", external_customer_id="customer_123")
    await ingestion.flush()
    return {"ok": True}
```

### Buffer options and defaults

Pass a `buffered` dictionary to `polar.ingestion()`:

| Option | Default | Meaning |
| --- | --- | --- |
| `batch_size` | `100` | Maximum events per HTTP request. |
| `batch_interval` | `1.0` | Seconds to collect a batch, starting with its first event. |
| `shutdown_timeout` | `5.0` | Seconds allowed to drain on context exit. |
| `max_attempts` | `3` | Total attempts per batch, including the first. |
| `on_dropped` | `None` | Async callback receiving the dropped events and reason. |

Network errors, rate limits, and server errors are retried with exponential backoff and jitter;
a rate limit's retry delay is honored when supplied. Other Polar API errors drop the batch
without retrying. Drops are always logged.

```python
from polar.ingestion import DropReason, EventInput


async def on_dropped(events: list[EventInput], reason: DropReason) -> None:
    print(f"Could not deliver {len(events)} events: {reason}")


# Use inside the PolarAsync context:
async with polar.ingestion(
    buffered={"batch_size": 50, "batch_interval": 0.5, "on_dropped": on_dropped},
    outpost=False,
) as ingestion:
    await ingestion.ingest(name="api_request", external_customer_id="customer_123")
```

Drop reasons are `retry_exhausted`, `permanent_error`, and `shutdown_timeout`.
The callback is awaited; the example only prints failures, so replace it with your recovery logic.

### Enable Outpost

Outpost runs inside your application. It uses meter configuration and customer snapshots
received from Polar over a WebSocket, reduces new events locally, and shares recent usage
through Redis. Reads combine Polar's historical snapshots with recent usage. The buffered
strategy still sends the events to Polar for authoritative processing and billing.

Use the same Redis instance for application instances that need to share Outpost usage.
Local writes are visible to the writer before ingestion returns; other instances converge
as Redis updates propagate. Outpost is not a replacement for event delivery to Polar.

Creating an actor warms its customer state to reduce the latency of later meter reads.
When enabled, Outpost handles meter reads. Its missing results and errors are propagated;
the ingestion helper does not retry those reads through HTTP. A read can fail if Redis is
unavailable or the initial customer snapshot is not ready.

Install the optional dependencies and provide a Redis URL:

```bash
uv add "polar-sdk[outpost]"
export REDIS_URL="redis://localhost:6379/0"
```

With `REDIS_URL` set, `polar.ingestion()` enables Outpost automatically. You can also configure
it explicitly:

```python
async with polar.ingestion(
    outpost={"redis_url": "redis://localhost:6379/0", "telemetry": False},
) as ingestion:
    actor = await ingestion.actor(external_customer_id="customer_123")
    meter = await actor.meter("meter_uuid")
```

| Option | Default | Meaning |
| --- | --- | --- |
| `redis_url` | `REDIS_URL` environment variable | Redis instance used by Outpost. |
| `telemetry` | `True` | Send Outpost metrics and traces to Polar. |

`POLAR_OUTPOST_TELEMETRY=0` disables telemetry regardless of the option. Cold reads wait up to
5 seconds for the initial snapshot. Passing an `outpost` dictionary without a configured Redis
URL raises `IngestionError`.

### Custom strategies

Pass `strategies` to replace all defaults. It cannot be combined with `buffered` or `outpost`.
Each strategy implements `IngestionStrategyProtocol`: an async context manager with an
`ingest(event)` method. The optional `actor()`, `meter()`, and `flush()` capabilities enable
warmup, reads, and draining. The first strategy providing `meter()` handles reads; with none,
the helper uses HTTP. Strategies start in list order and close in reverse order.

For example, to explicitly select only the buffered strategy:

```python
from polar.ingestion.buffered import BufferedIngestionStrategy

async with polar.ingestion(
    strategies=[BufferedIngestionStrategy(polar, batch_size=50)],
) as ingestion:
    await ingestion.ingest(name="api_request", external_customer_id="customer_123")
```

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