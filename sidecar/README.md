# Polar Sidecar

A small FastAPI app that sits in front of the Polar API.

- `POST /v1/events/ingest` buffers events in a local database and returns
  immediately. A background sync loop forwards unacknowledged events upstream
  and stamps `acknowledged_at` once Polar confirms them, so events survive
  upstream downtime. The event timestamp is stamped at ingest time when the
  caller doesn't supply one, preserving when the event actually happened.
- Every other request falls through to a transparent proxy to the Polar API.

## Configuration

| Variable                 | Default                              | Description                                            |
| ------------------------ | ------------------------------------ | ------------------------------------------------------ |
| `POLAR_SERVER`           | `production`                         | Named Polar server (`production`/`sandbox`).           |
| `POLAR_SERVER_URL`       | _(unset)_                            | Overrides `POLAR_SERVER` with a full URL.              |
| `DATABASE_URL`           | `sqlite+aiosqlite:///./sidecar.db`   | SQLAlchemy async URL for the local buffer.             |
| `POLAR_ACCESS_TOKEN`     | _(unset)_                            | Token the sync loop uses upstream. Unset = loop idles. |
| `FLUSH_INTERVAL_SECONDS` | `5`                                  | Seconds between sync loop cycles.                      |
| `FLUSH_BATCH_SIZE`       | `100`                                | Max events forwarded per cycle.                        |

## Running

```bash
uv sync
uv run task api   # http://127.0.0.1:8000
```
