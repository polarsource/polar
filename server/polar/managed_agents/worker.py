"""Self-hosted sandbox worker for the Plain triage Managed Agent.

Long-running process that polls Anthropic's environment work queue and
executes tool calls inside Polar's VPC. Deploy as its own Render
background worker (or similar long-running process); do NOT run it
inside the existing Dramatiq worker — it owns its asyncio loop end-to-end.

Run:

    uv run python -m polar.managed_agents.worker

Required env (read from polar.config.settings; falls back to bare env
vars for ANTHROPIC_ENVIRONMENT_KEY since it is environment-scoped, not
the org API key):

    ANTHROPIC_ENVIRONMENT_KEY  -- sk-ant-oat01-... from the Anthropic
                                  Console (Environments → Generate key).
                                  Distinct from ANTHROPIC_API_KEY — do
                                  NOT set ANTHROPIC_API_KEY in this
                                  worker; the env key is what scopes
                                  the worker to one environment.
    POLAR_MANAGED_ENV_ID       -- env_... for the self_hosted env.
    POLAR_MANAGED_READ_DSN     -- postgresql://polar_read:...@...
                                  Reaches prod via Tailscale; in dev
                                  point at the local docker DB.

The Plain MCP dispatch still happens on Anthropic's side (the vault
credential is injected after the request leaves the sandbox boundary
on their orchestration layer), so the worker only needs DB access.

NOTE on the SDK surface: this file uses the `EnvironmentWorker`
helper and the `@beta_tool` decorator from anthropic.lib. The exact
import paths and the way custom tools compose with `beta_agent_toolset`
have shifted across SDK releases — if your installed version exposes
a different shape, follow `shared/managed-agents-self-hosted-sandboxes.md`
and the SDK's environments README. The conceptual structure here is:

    1. Build the built-in toolset (bash/read/write/edit/glob/grep) via
       `beta_agent_toolset(AgentToolContext(...))`.
    2. Concat our custom @beta_tool functions onto that list.
    3. Run `EnvironmentWorker` against the work queue with `tools=`.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

import asyncpg
from anthropic import AsyncAnthropic
from anthropic.lib.environments import (
    AgentToolContext,
    EnvironmentWorker,
    beta_agent_toolset,
)
from anthropic.lib.tools import beta_tool

from polar.config import settings

log = logging.getLogger(__name__)

# Module-level pool. Initialized once in main() before EnvironmentWorker
# starts dispatching work. Bounded so a runaway agent can't open
# hundreds of connections.
_pool: asyncpg.Pool | None = None


def _pool_required() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError(
            "DB pool not initialized — worker.main() must run first"
        )
    return _pool


@beta_tool
async def polar_lookup_user_by_email(email: str) -> dict[str, Any]:
    """Look up a Polar user (merchant / account owner) by email.

    Returns the user record plus the organizations they belong to.
    This is the right tool for most support emails — Polar merchants
    typically email support from their account email. Empty result
    means no Polar user account; try polar_lookup_customer_by_email
    next in case they are an end-user of a Polar merchant.
    """
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
    return {"user": dict(user), "organizations": [dict(r) for r in orgs]}


@beta_tool
async def polar_lookup_customer_by_email(email: str) -> dict[str, Any]:
    """Look up a Polar "customer" — an end-user of a Polar merchant.

    Returns customer id, the merchant's organization, and basic
    profile fields. NOT the right tool for Polar merchants themselves —
    for those, use polar_lookup_user_by_email.
    """
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
    return {"matches": [dict(r) for r in rows]}


@beta_tool
async def polar_lookup_organization(
    identifier: str, identifier_type: str
) -> dict[str, Any]:
    """Look up a Polar organization by id or slug.

    identifier_type must be one of "id" (UUID) or "slug" (string).
    Returns id, slug, name, created_at, and counts of recent paid
    and non-paid orders.
    """
    if identifier_type not in {"id", "slug"}:
        return {"error": "identifier_type must be 'id' or 'slug'"}
    pool = _pool_required()

    if identifier_type == "id":
        # Validate the UUID client-side so a bad input gets a clear
        # error instead of an opaque InvalidTextRepresentation.
        import uuid

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
                  AND ord.status NOT IN ('paid', 'pending')
                  AND ord.created_at > NOW() - INTERVAL '30 days'
                  AND ord.deleted_at IS NULL
            ) AS non_paid_orders_30d
        FROM organizations o
        WHERE {where_clause}
          AND o.deleted_at IS NULL
        LIMIT 1
        """,
        identifier,
    )
    return {"organization": dict(row) if row else None}


@beta_tool
async def polar_recent_orders(
    customer_id: str, limit: int = 10
) -> dict[str, Any]:
    """Last N orders for a Polar customer (default 10, max 50).

    Returns product, amount, status, currency, and created_at. Use to
    diagnose billing complaints.
    """
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
    return {"orders": [dict(r) for r in rows]}


@beta_tool
async def polar_recent_subscriptions(customer_id: str) -> dict[str, Any]:
    """Active and recently-cancelled subscriptions for a Polar customer.

    Returns product, status, current period bounds, started_at, and
    canceled_at. Use to diagnose plan/access complaints.
    """
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
        LEFT JOIN products p ON s.product_id = p.id
        WHERE s.customer_id = $1::uuid
          AND s.deleted_at IS NULL
        ORDER BY s.created_at DESC
        LIMIT 20
        """,
        customer_id,
    )
    return {"subscriptions": [dict(r) for r in rows]}


POLAR_TOOLS = [
    polar_lookup_user_by_email,
    polar_lookup_customer_by_email,
    polar_lookup_organization,
    polar_recent_orders,
    polar_recent_subscriptions,
]


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

    _pool = await asyncpg.create_pool(
        dsn=dsn,
        min_size=1,
        max_size=4,
        command_timeout=30,
        server_settings={"default_transaction_read_only": "on"},
    )
    log.info("DB pool ready against polar_read role")

    async with AsyncAnthropic(auth_token=environment_key) as client:
        # AgentToolContext fetches per-session details (skills, etc.)
        # for the built-in toolset. session_id is set per work item by
        # EnvironmentWorker — passing None here means "let the worker
        # supply it as work arrives".
        ctx = AgentToolContext(workdir="/workspace", client=client)
        builtin = list(beta_agent_toolset(ctx))
        tools = builtin + POLAR_TOOLS

        log.info(
            "starting EnvironmentWorker against %s with %d tools",
            environment_id,
            len(tools),
        )
        try:
            await EnvironmentWorker(
                client,
                environment_id=environment_id,
                environment_key=environment_key,
                workdir="/workspace",
                tools=tools,
            ).run()
        finally:
            assert _pool is not None
            await _pool.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
