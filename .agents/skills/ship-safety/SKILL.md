---
name: ship-safety
description: Check whether a diff is safe to deploy — schema changes that break the currently running code, blocking DDL, renaming or moving background task actors while jobs are in flight, queue priority, cron catch-up, locking, batch size, and whether the change should be split into more than one PR. Use before merging a PR that touches migrations, tasks.py, models, or removes an endpoint.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Ship Safety (Polar)

The handle is the **diff**. The evidence is **what breaks between the moment this merges and
the moment it is fully deployed**.

Every check here is about that gap. Polar does not deploy atomically: migrations run first,
the API deploys before the workers, the old frontend can be live against the new backend, and
the queues already hold jobs enqueued under the old names. Code that is correct in its final
state can still take production down on the way there.

## Scope

Diffs touching `server/migrations/versions/`, `**/tasks.py`, `polar/models/`,
`server/scripts/`; or that remove or rename an endpoint; or that span `server/` and `clients/`
with a dependency between them.

**Owned elsewhere.** `ADR-0006` covers the migration rules — lock timeout, nullable → batched
`run_batched_update` script → NOT NULL across separate PRs, the unconditional `UPDATE` in the
enforce migration, and keeping migration PRs isolated from code. CI enforces it with the
Migration Isolation Check. `adr-check` reports violations; do not restate ADR-0006 here.
Reinvented helpers → `reuse-check`. Billing-specific lock and cycle rules → `billing-review`.

What is left for you is everything ADR-0006 does not say.

## Checks

### 1. Schema ahead of code

ADR-0006 stops code shipping ahead of its schema. The reverse still bites: between the
migration and the new code, the **old code runs against the new schema**.

- **Dropping a column or table** breaks the running app immediately — SQLAlchemy maps every
  model to a table at import, so a dropped table can fail before any query runs. Stop using
  it, deploy, drop in a later PR.
- **Renaming** is always two steps.

Ask of every schema change: *is the currently-deployed code still correct against this?*

### 2. Blocking DDL

- `postgresql_concurrently=True` for an index on a large table, with the migration outside a
  transaction.
- For NOT NULL on a large table, prefer `CHECK ... NOT VALID` then `VALIDATE CONSTRAINT`, so
  Postgres skips the full-table lock. On a small table this is ceremony — say which you think
  applies.
- New foreign keys on money tables get `ondelete="restrict"`.

### 3. Tasks already in flight

When the PR merges, the queues hold jobs enqueued by the old code.

- **Renaming an actor strands every queued job** — the worker looks for the old `actor_name`
  and finds nothing. Sequence: add `order.invoice.v2`, start enqueueing it, deploy, wait for
  the old queue to drain, then remove the old actor and swap the name back. Moving an actor to
  a different queue is the same problem.
- **Changing a signature** breaks jobs enqueued with the old arguments. New parameters need
  defaults.
- **Queue priority.** `TaskPriority.HIGH` is checkout-path only. Analytics, exports and
  backfills go `LOW`. Slow work on `HIGH` starves checkout.
- **Cron actors.** A new `cron_trigger` needs an answer for a missed run. A catch-up loop that
  walks forward through skipped periods usually computes state wrong; prefer an invariant
  alert that the run did not happen.
- **Retries.** Polar relies on automatic retries. A new failure path must raise, not swallow,
  and `max_retries=0` must be deliberate.

### 4. Locks and volume

- A new `with_for_update` belongs in the task or service that owns the unit of work, not
  inside a processor-specific helper. Every lock needs an answer to *what releases this if the
  process dies?*
- Release on one path only. A lock released on two paths is a bug waiting to happen.
- Loading every matching row into memory does not survive production volume.
- A scheduled sweep that scans an entire busy table needs an index or a bounded window.

### 5. Split this PR

Flag for splitting when the diff:

- removes a backend endpoint **and** updates its frontend caller — the old frontend can be
  live against the new backend;
- renames an actor and removes the old one together;
- changes native mobile code alongside TypeScript — native blocks an over-the-air release, so
  ship the TS-only change first;
- was already flagged in review as "should move to another module". A follow-up PR is a fine
  answer, but say so rather than silently deferring.

## Output

```
## Ship Safety

### 🔴 Blocking
- `file:line` — <what breaks, in which window>. Fix: <fix>

### 🟠 Should fix
- `file:line` — <what happens under load>. Fix: <fix>

### 🟡 Question
- `file:line` — <question, including "split this PR?">

### Notes
- run before merge: <script path, or none>
- manual step after deploy: <e.g. "remove order.invoice v1 after 4h", or none>

### Verdict
✅ Safe to ship  |  ❌ n blocking, n should-fix
```

Fill in Notes even when the verdict is green. A required script run that is not written down
is a required script run that does not happen.
