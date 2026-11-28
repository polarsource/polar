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

Pass an `httpx2.Timeout` or `httpx.Timeout` instance to configure connect, read, write, and pool timeouts separately.
If your application uses `httpx`, declare it as a direct dependency.

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

## Actors and event delivery

Use an actor to bind a customer and optional member. `PolarAsync` buffers events in
memory by default. The client opens the queue on entry and drains it on exit.
Pass `event_queue` to customize delivery or `event_queue=None` to disable it.

```python
from polar.v2026_10 import PolarAsync


async def record_usage() -> None:
    async with PolarAsync("polar_oat_xxx") as polar:
        actor = polar.actor(external_customer_id="customer_123")
        await actor.track(name="api_request", metadata={"tokens": 42})
        usage = await actor.meter("meter_uuid")
```

Use `polar.track(...)` or `polar.meter(...)` to pass the customer ID on each call.
Meter reads are customer-wide and work without a queue. `track()` requires a queue
and an open client context. It assigns a timestamp and external ID when omitted.

### Local reduction with Outpost

Pass `outpost={"redis": redis_url}` to `PolarAsync` to enable local meter reads.
Outpost applies events locally after enqueue succeeds. If it cannot answer a
meter read, the client queries the Polar API. Install the `outpost` extra with
`uv add "polar-sdk[outpost]"`.

Call `await actor.warmup()` inside the client context to warm the customer's state
across all configured Outpost reducers before reading a meter.

```python
async with PolarAsync(token, outpost={"redis": "redis://localhost:6379"}) as polar:
    actor = polar.actor(external_customer_id="customer_123")
    await actor.track(name="api_request")
    usage = await actor.meter("meter_uuid")
```

For durable delivery, pass a `RedisEventQueue` as `event_queue`. Use a different
queue stream for each Polar environment and organization. When Outpost and the
queue use the same Redis URL, they share a Redis client. If you pass your own
asynchronous Redis client, close it after `PolarAsync` exits.

### Delivery

The in-memory queue queues events in memory and sends them in batches of up to `batch_size`
events, or every `batch_interval` seconds. `track()` never waits for the HTTP request.

On a long-running server, keep one `PolarAsync` context open for the application's lifetime
and let background batching deliver events. Share it between requests on the same event loop.
Leaving the context drains the queue within `shutdown_timeout` (30 seconds by default) and
raises if any earlier, unacknowledged events could not be confirmed.

In serverless environments such as Vercel or AWS Lambda, await `polar.flush(timeout=30)` before
returning from each request, so the function does not freeze with events in the queue. It
waits for events queued before the call without closing the shared helper. A newer flush
releases older ones whose deadline is no later than its own and waits for their events too,
so concurrent handlers do not each wait for a round trip to Polar. Concurrent handlers share
HTTP batches.

```python
async def handle_request() -> dict[str, bool]:
    await polar.track(name="api_request", external_customer_id="customer_123")
    await polar.flush(timeout=30)
    return {"ok": True}
```

For a handler that owns its own helper, context exit drains automatically:

```python
from polar.metering.queue.memory import MemoryEventQueue


async def handle_request() -> dict[str, bool]:
    queue = MemoryEventQueue(shutdown_timeout=30)
    async with PolarAsync(token, event_queue=queue) as polar:
        await polar.track(name="api_request", external_customer_id="customer_123")
    return {"ok": True}
```

A `flush()` confirms delivery unless a newer flush released it. Failed delivery raises
`MeteringDeliveryError`, importable from `polar.metering.errors`. Its `events` contains the unconfirmed events; each item in
`failures` includes `events`, a `reason`, and the original `cause`. Drops are still logged
and permanent rejections are passed to the queue session's rejection hook. A completed flush acknowledges the reported failures, so a later
flush reports only subsequent outcomes. The newest overlapping flush reports the failures of
the ones it released.
Periodically flush long-running helpers to observe failures and release their retained records.

If the wait expires, `flush()` raises `MeteringTimeoutError`. Timeout and caller cancellation
do not stop background delivery or other callers, and leave failures observable by a later
flush or context exit. The flush timeout bounds the caller's wait; `shutdown_timeout` bounds
context cleanup. Both are independent of the HTTP client's request timeout. Shutdown may
interrupt delivery callbacks when its deadline expires. If both the context body and delivery
fail, exit raises an exception group preserving both errors.

When Polar answers `429 Too Many Requests`, the helper waits for `Retry-After`, then sends
full batches. A flush waits for this delivery only up to its timeout. The rate limit counts
requests, not events, so batching keeps request volume down.

The buffer is in memory: forced process termination can still lose events. Choose deadlines
that fit within the function's execution limit; use durable storage when delivery must survive
termination. A timeout means delivery is unconfirmed, so blindly retrying may duplicate events.

### Delivery callbacks

Pass async `on_event_ack(events)` and `on_event_rejected(events, reason)` callbacks to `PolarAsync`
to observe delivery.

### Options

#### Memory

The in-memory queue sends events in batches to Polar. It retries network errors, HTTP 408 responses, and server errors with exponential backoff and jitter. On a rate limit it waits out `Retry-After`, for up to five minutes per batch. Other Polar API errors drop the batch.

| Option             | Default | Meaning                                                    |
| ------------------ | ------- | ---------------------------------------------------------- |
| `batch_size`       | `100`   | Maximum events per HTTP request.                           |
| `batch_interval`   | `1.0`   | Seconds to collect a batch, starting with its first event. |
| `shutdown_timeout` | `30.0`  | Seconds allowed to drain on context exit.                  |
| `max_attempts`     | `3`     | Total attempts per batch, including the first.             |

#### Outpost

| Option             | Default                          | Meaning                                              |
| ------------------ | -------------------------------- | ---------------------------------------------------- |
| `redis`            | Required                         | Redis URL or caller-owned asynchronous Redis client. |
| `telemetry`        | `True`                           | Send Outpost metrics and traces to Polar.            |
| `snapshot_timeout` | `5`                              | Seconds a cold read waits for its initial snapshot.  |

Telemetry can also be disabled with the `POLAR_OUTPOST_TELEMETRY=0` environment variable.

## FastAPI

Install the `fastapi` extra and set `POLAR_ACCESS_TOKEN` to your organization access token.

```bash
uv add "polar-sdk[fastapi]"
```

`PolarMiddleware` opens the client at startup and closes it at shutdown. Use
`PolarDependency[PolarAsync]` to inject the shared client into your endpoints. Use the same
`PolarAsync` version for the middleware and the dependency.

The example uses your app's authenticated-user dependency, `User`. The user's ID must match
the external ID of their Polar customer.

```python
import os

from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from my_app.auth import User
from polar.integrations.fastapi import PolarDependency, PolarMiddleware
from polar.v2026_10 import PolarAsync

app = FastAPI()
app.add_middleware(
    PolarMiddleware,
    client_class=PolarAsync,
    access_token=os.environ["POLAR_ACCESS_TOKEN"],
)

PolarClient = PolarDependency[PolarAsync]


@app.get("/customer-portal")
async def customer_portal(user: User, polar: PolarClient) -> RedirectResponse:
    session = await polar.customer_sessions.create(external_customer_id=str(user.id))
    return RedirectResponse(session.customer_portal_url)
```

### Track events

Use the same injected client to track events. The client drains its configured
queue before closing its HTTP transport at shutdown.

```python
@app.post("/track")
async def track_usage(user: User, polar: PolarClient) -> dict[str, bool]:
    await polar.track(name="api_request", external_customer_id=str(user.id))
    return {"ok": True}
```

On Vercel, install the `vercel` Python SDK to let the middleware flush events with
`wait_until` after each HTTP request. Without the Vercel SDK, the middleware awaits
the flush before handing control back to the runtime.

#### Redis queue and Outpost

Install both extras and set `REDIS_URL`.

```bash
uv add "polar-sdk[fastapi,outpost]"
```

Pass the queue and Outpost options to the same `PolarMiddleware` registration.
The queue and Outpost share a Redis client when their URLs match.

```python
from polar.metering.queue.redis import RedisEventQueue

redis_url = os.environ["REDIS_URL"]
app.add_middleware(
    PolarMiddleware,
    client_class=PolarAsync,
    access_token=os.environ["POLAR_ACCESS_TOKEN"],
    event_queue=RedisEventQueue(redis_url, stream="my-app:production:org:events"),
    outpost={"redis": redis_url},
)
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