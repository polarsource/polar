---
name: api-surface-review
description: Review changes to Polar's API contract — Pydantic schemas, FastAPI endpoints, OpenAPI output and the generated SDKs. Checks public vs private exposure, schema shape and naming, and whether the change breaks merchants or the generated clients. Use when a diff touches schemas.py, endpoints.py, docs/openapi.json or sdk/, or when the user asks whether an API change is breaking.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# API Surface Review (Polar)

The handle is the **diff**. The evidence is **what this change does to the API contract**, and
whether any of it is breaking.

This is where Polar's most expensive review mistakes live. A schema change does not stay in
the repo: it flows into `docs/openapi.json`, the generated TypeScript client, the Speakeasy
SDKs under `sdk/`, and out to merchants who already wrote code against it.

## Scope

Diffs touching `**/schemas.py`, `**/endpoints.py`, `polar/openapi.py`, `docs/openapi.json`,
`sdk/`, `clients/packages/client/`.

**CI already does part of this job.** The `OpenAPI Diff` workflow posts the schema delta as a
PR comment, and `OpenAPI Client Regeneration Check` fails if the client is stale. Do not
recompute either by hand. Read the diff comment if it exists and judge whether the delta is
acceptable; that judgement is the thing CI cannot make.

Owned elsewhere: `ADR-0002` (status-coded `PolarError`), `ADR-0007` (no default in output
schemas) → `adr-check`. Endpoint conventions written in `server/AGENTS.md` — `response_model`
and ORM returns, POST/PATCH/DELETE status codes, `ListResource`, `responses=`, the
`PolarRequestValidationError` boundary → `conventions-check`. Existing shared types →
`reuse-check`.

## Checks

### 1. Public or private

`APITag` has two values, `public` and `private` (`polar/openapi.py`). Public means documented
and in the SDKs.

- Set it deliberately on every new router and route. Never hide something with
  `include_in_schema=False`; use `tags=[APITag.private]`.
- Tag the route, not the router, when only one route should change. The pattern: keep
  `APITag.public` on what stays, add `APITag.private` to the deprecated one.
- Private endpoints (payouts are the standing example) are not in the SDK. Do not reason about
  them as public API.
- **On every new field, ask: does a merchant need to see this?** Internal `Organization`
  settings keep leaking into the public API this way.

### 2. Schema shape

- Output fields are required, nullable where needed. A `default` makes them optional in
  OpenAPI, which generates a wrongly-optional TS field. (ADR-0007 — name it, do not restate it.)
- Type fields with their enum, not `str`.
- Reuse a related resource's base schema rather than redefining its fields:
  `class DisputeCustomer(CustomerBase): ...`.
- A value that already exists as a model property is a plain field, not a reimplemented
  `computed_field`.
- Descriptions are user-facing: no implementation detail, and write `None` not `null`.
- Any field writing to a SQL `INT` column is `Int32`, so out-of-range input is rejected at
  validation instead of overflowing.
- Constrain enums by listing allowed values (`reason: Literal[RefundReason.foo, ...]`) rather
  than a hand-rolled validator. Pydantic validates, OpenAPI documents.
- Discriminated unions get a plain `Discriminator` plus `SetSchemaReference`, so the union
  lands in OpenAPI properly.
- Do not over-constrain fields fed by a payment processor. *"We'll never know what Stripe or
  other payment processor will send us."*

### 3. Naming

The union takes the clean name, the variants get qualified: `CustomerCreate` is the union,
`CustomerIndividualCreate` and `CustomerTeamCreate` are members. Same for `CustomerState`.

Fields are `snake_case`. Prefer explicit over clever (`payment_method_type`, not
`payment_method`). Do not overload an existing concept with a new meaning.

### 4. Breaking changes

Breaking = removing a field, flipping required/optional, changing a type, renaming anything,
or changing a status code a client branches on.

Before removing a field or behaviour:

1. **Check Logfire for real usage.** This is what François actually does. Merchants create
   things programmatically that nobody expects.
2. If it is used, keep a compatibility layer and use `SkipJsonSchema` so runtime still accepts
   the value while it disappears from future SDKs.
3. If it is genuinely breaking, say so plainly. That is a human decision, not something to
   wave through.

### 5. Route shape

Only the parts `AGENTS.md` does not already cover:

- Trailing slash on root endpoints.
- Errors on the same route need distinct status codes, or their schemas collide in the OpenAPI
  output.
- A query parameter must act as a pure filter. If it changes the response shape, the resource
  is wrong and it wants its own route.
- Removing an endpoint and updating its frontend caller in one PR is a deploy hazard →
  `ship-safety` owns the split.

## Output

```
## API Surface

### 🔴 Blocking
- `file:line` — <what breaks, and for whom>. Fix: <fix>

### 🟠 Should fix
- `file:line` — <claim>. Fix: <fix>

### 🟡 Question
- `file:line` — <question>

### Notes
- public surface delta: <one line, or "see the OpenAPI Diff PR comment">

### Verdict
✅ Clean  |  ❌ n blocking, n should-fix
```

Anything blocking needs a human decision before merge.
