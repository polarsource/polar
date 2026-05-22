"""Self-hosted sandbox worker for the Plain triage Managed Agent.

Long-running process that polls Anthropic's environment work queue and
executes tool calls inside Polar's VPC. Deploy as its own Render
background worker (or similar long-running process); do NOT run it
inside the existing Dramatiq worker — it owns its asyncio loop end-to-end.

Run:

    uv run python -m polar.managed_agents.worker

Required env:

    ANTHROPIC_ENVIRONMENT_KEY  -- sk-ant-oat01-... from the Anthropic
                                  Console (Environments → Generate key).
                                  Distinct from ANTHROPIC_API_KEY — the
                                  env key scopes the worker to one
                                  environment.
    POLAR_MANAGED_ENV_ID       -- env_... for the self_hosted env.
    POLAR_MANAGED_READ_DSN     -- postgresql://polar_read:...@...

Optional:

    POLAR_MANAGED_WORKDIR      -- defaults to /tmp/polar-managed-agents-workspace.
                                  Created automatically; used by the
                                  built-in bash/read/write tools.
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import asyncpg
from anthropic import AsyncAnthropic
from anthropic.lib.environments import EnvironmentWorker
from anthropic.lib.tools import beta_async_tool
from anthropic.lib.tools.agent_toolset import (
    AgentToolContext,
    beta_agent_toolset_20260401,
)

from polar.config import settings

log = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


def _pool_required() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError(
            "DB pool not initialized — worker.main() must run first"
        )
    return _pool


def _jsonable(value: Any) -> Any:
    """Coerce asyncpg row values into JSON-native shapes.

    asyncpg returns datetime/date/UUID/Decimal/etc. as Python types,
    and the SDK serializes tool returns with stdlib json — which
    refuses those types. We narrow them here at the boundary instead
    of relying on a serializer kwarg the SDK may or may not expose.
    """
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Decimal):
        # Strings round-trip exactly; the model can parse them as needed.
        return str(value)
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    return value


def _row(record: asyncpg.Record | None) -> dict[str, Any] | None:
    return _jsonable(dict(record)) if record is not None else None


def _rows(records: list[asyncpg.Record]) -> list[dict[str, Any]]:
    return [_jsonable(dict(r)) for r in records]


async def _safe(fn: Any, *args: Any, **kwargs: Any) -> dict[str, Any]:
    """Run a DB handler and return either its dict result, or a
    `{error, detail}` dict on exception. We never let an exception
    escape the @beta_async_tool — that would crash the worker for
    every session, not just this tool call."""
    try:
        return await fn(*args, **kwargs)
    except Exception as exc:
        log.exception("custom tool failed: %s", fn.__name__)
        return {"error": type(exc).__name__, "detail": str(exc)}


# ---- DB tool implementations -----------------------------------------------


async def _impl_lookup_user_by_email(email: str) -> dict[str, Any]:
    pool = _pool_required()
    user = await pool.fetchrow(
        """
        SELECT u.id::text AS id, u.email, u.created_at
        FROM users u
        WHERE LOWER(u.email) = LOWER($1)
          AND u.deleted_at IS NULL
        LIMIT 1
        """,
        email,
    )
    if user is None:
        return {"user": None, "organizations": []}
    orgs = await pool.fetch(
        """
        SELECT o.id::text AS id, o.slug, o.name, o.created_at
        FROM user_organizations uo
        JOIN organizations o ON uo.organization_id = o.id
        WHERE uo.user_id = $1::uuid
          AND o.deleted_at IS NULL
        ORDER BY o.created_at DESC
        LIMIT 50
        """,
        user["id"],
    )
    return {"user": _row(user), "organizations": _rows(orgs)}


async def _impl_lookup_customer_by_email(email: str) -> dict[str, Any]:
    pool = _pool_required()
    rows = await pool.fetch(
        """
        SELECT
            c.id::text AS id,
            c.email,
            c.name,
            c.external_id,
            c.created_at,
            o.id::text AS organization_id,
            o.slug AS organization_slug,
            o.name AS organization_name
        FROM customers c
        LEFT JOIN organizations o ON c.organization_id = o.id
        WHERE LOWER(c.email) = LOWER($1)
          AND c.deleted_at IS NULL
        ORDER BY c.created_at DESC
        LIMIT 20
        """,
        email,
    )
    return {"matches": _rows(rows)}


async def _impl_lookup_organization(
    identifier: str, identifier_type: str
) -> dict[str, Any]:
    if identifier_type not in {"id", "slug"}:
        return {"error": "identifier_type must be 'id' or 'slug'"}

    if identifier_type == "id":
        try:
            uuid.UUID(identifier)
        except ValueError:
            return {
                "error": "identifier was not a valid UUID; "
                "retry with identifier_type='slug'"
            }
        where_clause = "o.id = $1::uuid"
    else:
        where_clause = "o.slug = $1"

    pool = _pool_required()
    row = await pool.fetchrow(
        f"""
        SELECT
            o.id::text AS id,
            o.slug,
            o.name,
            o.created_at,
            (
                SELECT COUNT(*) FROM orders ord
                WHERE ord.organization_id = o.id
                  AND ord.status = 'paid'
                  AND ord.created_at > NOW() - INTERVAL '30 days'
                  AND ord.deleted_at IS NULL
            ) AS paid_orders_30d,
            (
                SELECT COUNT(*) FROM orders ord
                WHERE ord.organization_id = o.id
                  AND ord.status IN ('refunded', 'partially_refunded')
                  AND ord.created_at > NOW() - INTERVAL '30 days'
                  AND ord.deleted_at IS NULL
            ) AS refunded_orders_30d
        FROM organizations o
        WHERE {where_clause}
          AND o.deleted_at IS NULL
        LIMIT 1
        """,
        identifier,
    )
    return {"organization": _row(row)}


async def _impl_recent_orders(
    customer_id: str, limit: int = 10
) -> dict[str, Any]:
    try:
        uuid.UUID(customer_id)
    except ValueError:
        return {"error": "customer_id must be a UUID"}
    pool = _pool_required()
    capped = max(1, min(int(limit), 50))
    rows = await pool.fetch(
        """
        SELECT
            ord.id::text AS id,
            ord.status,
            ord.subtotal_amount,
            ord.net_amount,
            ord.tax_amount,
            (ord.net_amount + ord.tax_amount) AS total_amount,
            ord.currency,
            ord.created_at,
            p.name AS product_name
        FROM orders ord
        LEFT JOIN products p ON ord.product_id = p.id
        WHERE ord.customer_id = $1::uuid
          AND ord.deleted_at IS NULL
        ORDER BY ord.created_at DESC
        LIMIT $2
        """,
        customer_id,
        capped,
    )
    return {"orders": _rows(rows)}


async def _impl_recent_subscriptions(customer_id: str) -> dict[str, Any]:
    try:
        uuid.UUID(customer_id)
    except ValueError:
        return {"error": "customer_id must be a UUID"}
    pool = _pool_required()
    rows = await pool.fetch(
        """
        SELECT
            s.id::text AS id,
            s.status,
            s.current_period_start,
            s.current_period_end,
            s.started_at,
            s.canceled_at,
            s.ended_at,
            p.name AS product_name
        FROM subscriptions s
        JOIN products p ON s.product_id = p.id
        WHERE s.customer_id = $1::uuid
          AND s.deleted_at IS NULL
        ORDER BY s.created_at DESC
        LIMIT 20
        """,
        customer_id,
    )
    return {"subscriptions": _rows(rows)}


# ---- @beta_async_tool wrappers ---------------------------------------------
#
# We wrap each impl in `_safe(...)` to convert exceptions into
# `{error, detail}` results — the agent sees an opaque error rather
# than the worker crashing. Note: @beta_async_tool decorates async
# functions; using @beta_tool here would raise at first invocation.


@beta_async_tool
async def polar_lookup_user_by_email(email: str) -> dict[str, Any]:
    """Look up a Polar user (merchant / account owner) by email.

    Returns the user record plus the organizations they belong to.
    This is the right tool for most support emails — Polar merchants
    typically email support from their account email. Empty result
    means no Polar user account; try polar_lookup_customer_by_email
    next in case they are an end-user of a Polar merchant.
    """
    return await _safe(_impl_lookup_user_by_email, email)


@beta_async_tool
async def polar_lookup_customer_by_email(email: str) -> dict[str, Any]:
    """Look up a Polar "customer" — an end-user of a Polar merchant.

    Returns customer id, the merchant's organization, and basic
    profile fields. NOT the right tool for Polar merchants themselves —
    for those, use polar_lookup_user_by_email.
    """
    return await _safe(_impl_lookup_customer_by_email, email)


@beta_async_tool
async def polar_lookup_organization(
    identifier: str, identifier_type: str
) -> dict[str, Any]:
    """Look up a Polar organization by id or slug.

    identifier_type must be one of "id" (UUID) or "slug" (string).
    Returns id, slug, name, created_at, paid_orders_30d, and
    refunded_orders_30d.
    """
    return await _safe(_impl_lookup_organization, identifier, identifier_type)


@beta_async_tool
async def polar_recent_orders(
    customer_id: str, limit: int = 10
) -> dict[str, Any]:
    """Last N orders for a Polar customer (default 10, max 50).

    Returns product, amount, status, currency, and created_at. Use to
    diagnose billing complaints.
    """
    return await _safe(_impl_recent_orders, customer_id, limit)


@beta_async_tool
async def polar_recent_subscriptions(customer_id: str) -> dict[str, Any]:
    """Active and recently-cancelled subscriptions for a Polar customer.

    Returns product, status, current period bounds, started_at, and
    canceled_at. Use to diagnose plan/access complaints.
    """
    return await _safe(_impl_recent_subscriptions, customer_id)


POLAR_TOOLS = [
    polar_lookup_user_by_email,
    polar_lookup_customer_by_email,
    polar_lookup_organization,
    polar_recent_orders,
    polar_recent_subscriptions,
]


def _build_tools(env: AgentToolContext) -> list[Any]:
    """Factory form — EnvironmentWorker calls this per session, so the
    per-session AgentToolContext (with session_id, skills dir) flows
    through to the built-in toolset properly.
    """
    return list(beta_agent_toolset_20260401(env)) + POLAR_TOOLS


async def main() -> None:
    global _pool

    environment_key = os.environ.get("ANTHROPIC_ENVIRONMENT_KEY")
    if not environment_key:
        raise SystemExit(
            "ANTHROPIC_ENVIRONMENT_KEY is required (not "
            "ANTHROPIC_API_KEY — the env key scopes the worker to one "
            "environment and is generated from the Anthropic Console)."
        )
    environment_id = settings.POLAR_MANAGED_ENV_ID
    if not environment_id:
        raise SystemExit("POLAR_MANAGED_ENV_ID is required")
    dsn = settings.POLAR_MANAGED_READ_DSN
    if not dsn:
        raise SystemExit("POLAR_MANAGED_READ_DSN is required")

    workdir = os.environ.get(
        "POLAR_MANAGED_WORKDIR", "/tmp/polar-managed-agents-workspace"
    )
    os.makedirs(workdir, exist_ok=True)

    _pool = await asyncpg.create_pool(
        dsn=dsn,
        min_size=1,
        max_size=4,
        command_timeout=30,
        server_settings={"default_transaction_read_only": "on"},
    )
    log.info("DB pool ready against polar_read role")

    async with AsyncAnthropic(auth_token=environment_key) as client:
        log.info(
            "starting EnvironmentWorker against %s workdir=%s",
            environment_id,
            workdir,
        )
        try:
            await EnvironmentWorker(
                client,
                environment_id=environment_id,
                environment_key=environment_key,
                workdir=workdir,
                tools=_build_tools,
            ).run()
        finally:
            assert _pool is not None
            await _pool.close()
            _pool = None


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    asyncio.run(main())
