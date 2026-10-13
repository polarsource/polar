# Outpost SDK scenario harness

Python timelines exercise independent Python and TypeScript SDK processes sharing
a real, isolated Redis. Each test starts its own Redis on a loopback port, disables
persistence, and tears down every process afterward. No existing Redis is flushed.

Until Polar implements the SDK snapshot protocol, a local WebSocket fixture supplies
configuration and snapshots. This tests SDK synchronization across processes and
languages; it does not establish full Polar E2E correctness. It does not mock SDK
code or Redis. The TypeScript client imports the built SDK through a declared local
package link; Python imports its editable local SDK dependency. The harness owns its
Python virtual environment, Node dependencies, lockfiles, and tool configuration.

## Run

Requires `uv`, `just`, Node 24+, `pnpm`, and `redis-server` on PATH. Install the SDK
dependencies once (the TypeScript SDK needs its own build dependencies):

```sh
cd sdk/typescript && just install
cd ../e2e
just install
just test
```

Every scenario runs once with all Python clients and once with all TypeScript clients.
Use `just test -k python` or `just test -k typescript` to select one SDK.
Run `just lint` and `just typecheck` for both languages. The Node helpers are strict
TypeScript files executed directly by Node 24, without a separate harness build.
Async orchestration uses AnyIO, and pytest scenarios use `@pytest.mark.anyio`.
The pytest backend is asyncio because the Redis client requires it.
Python clients read stdin pipes through AnyIO readiness notifications, without a
worker thread. This pipe reader requires POSIX (Linux/macOS).

## Write a scenario

Add a `Scenario` to `scenarios.py`. Supply reducer configuration, initial snapshots,
and a list of typed steps. `Step` is a union of these dataclasses:

| Step | Required fields | Behavior |
| --- | --- | --- |
| `IngestStep` | `at`, `client`, `arguments` with an `events` list | Ingest local events |
| `ReadStep` | `at`, `client`, meter `arguments`, `expected` | Check meter values; optional `within` allows polling |
| `ActorStep` | `at`, `client`, customer `arguments` | Warm a customer |
| `RestartStep` | `at`, `client` | Restart the SDK process |
| `SnapshotStep` | `at`, snapshot `arguments` | Push a snapshot from the fixture server |

Operations are fixed literal values, not constructor arguments. Customer arguments
use either `customer_id` or `external_customer_id`; reads also require `meter_id`.
Expected values may contain `consumed_units`, `credited_units`, and/or `balance`.
Configuration, events, and snapshots reuse the Python SDK's payload types.

```python
Scenario(
    "peer catches up",
    CONFIGURATION,
    [INITIAL],
    [
        expect(0, "writer", 0),
        expect(0, "reader", 0),
        emit(0.2, "writer", 7),
        expect(0.3, "writer", 7, within=0),
        expect(0.3, "reader", 7, within=2),
    ],
)
```

The helpers compare consumed units, credited units, and balance together.

- `at`: seconds from the start of the timeline, after processes have started.
- `client`: an SDK process name; names are discovered from the scenario steps.
  Snapshot steps always target the reserved name `polar`.
- `arguments`: actual SDK keyword arguments, or a snapshot payload.
- `expected`: meter fields to compare exactly for a read.
- `within`: poll allowance in seconds; zero means a single read.

Timeline actions are dispatched independently; a polling assertion does not delay
later events. Commands to the same client, including restarts, are serialized. Use
distinct offsets for ordered actions; equal offsets deliberately allow concurrency. Startup readiness
means connected, not that initial customer snapshots have arrived: establish that
with an eventual initial read. Initial snapshots are pushed after configuration;
Python also requests snapshots, while TypeScript currently waits for server pushes.

Failures print the command transcript with scheduled/actual times, arguments, and
observed results. Client stderr remains visible for crashes. Calls have a ten-second
response timeout; `within` bounds polling, not the duration of an individual SDK call.

The concurrent scenario warms four writers and two dedicated readers, then runs
five rounds of simultaneous writes. Each writer adds a distinct amount (1–4 units)
per round; all six cached clients must converge to each cumulative total and retain
the final 50-unit consumption.

The bundled scenarios also cover shared consumption, restart recovery, snapshot
reconciliation, and ignoring events older than a snapshot cutoff.
Event timestamps are fixed independently of timeline scheduling, so bucket-boundary
tests need no five-minute sleeps.

Outpost ingestion only updates local aggregates. It neither sends events to Polar
nor deduplicates them. Once the server protocol is ready, replace the snapshot
fixture with the real API/worker stack and add a separate Polar-ingestion operation
and fixture provisioning. Keep local and authoritative ingestion separately
scheduled so scenarios can exercise delayed reconciliation.
