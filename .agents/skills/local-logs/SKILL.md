---
name: local-logs
description: Read the local Polar API and worker logs with `dev logs`. Use whenever something fails while working against the local stack, such as an API request returning 4xx or 5xx, a dashboard or checkout page showing an error, a background job not doing what it should, a webhook not arriving, or the user mentioning an error in their API or worker terminal. Check these logs before asking the user to paste a traceback.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Local logs

In development, the API and worker write every log record to `server/.logs/api.log` and
`server/.logs/worker.log`, alongside what they print in their terminals. You can read them
no matter how or where the user started the servers.

## Start here

```bash
dev logs --errors --since 10m
```

This shows the latest API and worker errors and how often each repeated. When the
record has them, it also shows the request or background job the error happened in and a short
traceback (code in this repo plus the line that raised). Narrow it with `dev logs api --errors` or `dev logs worker --errors`, and use
`--since 30s`, `5min`, `2h` or `1d` to skip errors from before what you are investigating.

Errors that happened in a request or a job end with a line like:

```
Everything from this request: dev logs --request 9fb0a1fc-9313-4ea6-9bfe-2989b531ec93
```

Run it to see every record the API and the worker logged for that request, including the
background jobs it enqueued, in order. It shows all of them; other views say how many records
they left out.

## Other views

| Command | Shows |
|---|---|
| `dev logs api` | The last 50 API records |
| `dev logs worker --tail 200` | The last 200 worker records |
| `dev logs --since 2m` | The last 50 records from the last two minutes; add `--tail 500` for more |

Never run `dev logs ... --follow`: it keeps printing until someone presses Ctrl+C, so it
never returns. Reproduce the problem first, then read the logs.

## Querying the files directly

Each line is one JSON object, so `jq` works when the views above are not enough:

```bash
jq -c 'select(.path == "/v1/checkouts/")' server/.logs/api.log | tail -20
```

Common fields: `timestamp` (UTC), `level`, `event`, `logger`, `correlation_id`; API records
add `method` and `path`; worker records add `actor_name`, `message_id` and
`source_correlation_id` (the request that enqueued the job). Errors carry `exception`, a list
with `exc_type`, `exc_value` and `frames`. Rotated files end in `.log.1`.

## What to know

- **Noise:** locally the API and worker log `prometheus_remote_write` errors every few
  seconds because no metrics server runs. Ignore them.
- **No log file:** the servers write these files only on a branch that has this feature, and
  only after they start on it. If `dev logs` says there is no log, ask the user to restart
  the API or worker.
- **Development only:** nothing is written in tests or any deployed environment.
- **The Docker stack:** `dev logs db`, `redis`, `minio` or `tinybird` still show Docker
  container logs, as before.
