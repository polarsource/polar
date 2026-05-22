"""Plain triage orchestrator — drives one Plain thread through the
Managed Agent and handles host-side custom tools.

Usage:

    uv run python -m polar.managed_agents.triage <plain_thread_id>

Required env vars (see README.md):
    ANTHROPIC_API_KEY       -- Anthropic API key (workspace-scoped).
    POLAR_MANAGED_AGENT_ID  -- agent_... ID from `ant beta:agents create`.
    POLAR_MANAGED_ENV_ID    -- env_... ID from `ant beta:environments create`.
    POLAR_MANAGED_VAULT_ID  -- vlt_... ID for the Plain MCP credential.
    POLAR_MANAGED_READ_DSN  -- Postgres DSN for the polar_read role
                               (reaches the prod DB via Tailscale; in
                               development point at the local docker DB).

The agent itself runs in Anthropic's cloud sandbox. This process:
  - opens an SSE stream on a new session,
  - kicks the agent off with a `user.message` referencing the thread,
  - answers `agent.custom_tool_use` events by querying the read-only DB,
  - approves/denies `agent.mcp_tool_use` events that hit the
    `always_ask` permission policy.

It deliberately never sends `replyToThread` confirmations — that tool is
not in the agent's allowlist, but the orchestrator double-checks before
emitting any `tool_confirmation` event.
"""

from __future__ import annotations

import asyncio
import sys
from typing import Any

import asyncpg
from anthropic import AsyncAnthropic

# Tools the orchestrator will never confirm, even if asked. This is
# defense-in-depth: the agent.yaml allowlist already omits them, but the
# orchestrator is the last line if the agent config drifts.
DENY_TOOLS = {
    "replyToThread",
    "createThread",
    "upsertCustomer",
    "upsertTenant",
    "deleteThreadFieldSchema",
}

# Read-only Plain tools — auto-approve at the orchestrator level if a
# confirmation prompt reaches us (e.g. because the per-tool
# `permission_policy: always_allow` overrides in agent.yaml aren't
# honored on `mcp_toolset` and the entire toolset defaults to
# `always_ask`).
AUTO_APPROVE_READS = {
    "getThreadDetails",
    "getCustomerDetails",
    "getUserByEmail",
    "searchThreads",
    "searchCustomers",
    "getCustomerThreads",
    "getLabels",
    "getTenantDetails",
}

# Custom tools the agent can call. The handlers are bound at module
# import time; each takes the parsed `input` object plus the asyncpg
# connection pool, and returns a JSON-serializable result.
CustomToolHandler = Any  # async def(input: dict, pool: asyncpg.Pool) -> dict


async def _lookup_customer_by_email(
    input: dict, pool: asyncpg.Pool
) -> dict:
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
        LIMIT 5
        """,
        input["email"],
    )
    return {"matches": [dict(r) for r in rows]}


async def _lookup_organization(input: dict, pool: asyncpg.Pool) -> dict:
    where, value = (
        ("o.id = $1::uuid", input["identifier"])
        if input["identifier_type"] == "id"
        else ("o.slug = $1", input["identifier"])
    )
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
            ) AS paid_orders_30d,
            (
                SELECT COUNT(*) FROM orders ord
                WHERE ord.organization_id = o.id
                  AND ord.status != 'paid'
                  AND ord.created_at > NOW() - INTERVAL '30 days'
            ) AS failed_orders_30d
        FROM organizations o
        WHERE {where}
          AND o.deleted_at IS NULL
        LIMIT 1
        """,
        value,
    )
    return {"organization": dict(row) if row else None}


async def _recent_orders(input: dict, pool: asyncpg.Pool) -> dict:
    rows = await pool.fetch(
        """
        SELECT
            ord.id::text AS id,
            ord.status,
            ord.subtotal_amount,
            ord.total_amount,
            ord.currency,
            ord.created_at,
            p.name AS product_name
        FROM orders ord
        LEFT JOIN products p ON ord.product_id = p.id
        WHERE ord.customer_id = $1::uuid
        ORDER BY ord.created_at DESC
        LIMIT $2
        """,
        input["customer_id"],
        input.get("limit", 10),
    )
    return {"orders": [dict(r) for r in rows]}


async def _recent_subscriptions(input: dict, pool: asyncpg.Pool) -> dict:
    rows = await pool.fetch(
        """
        SELECT
            s.id::text AS id,
            s.status,
            s.current_period_start,
            s.current_period_end,
            s.started_at,
            s.cancelled_at,
            s.ended_at,
            p.name AS product_name
        FROM subscriptions s
        LEFT JOIN products p ON s.product_id = p.id
        WHERE s.customer_id = $1::uuid
        ORDER BY s.created_at DESC
        LIMIT 20
        """,
        input["customer_id"],
    )
    return {"subscriptions": [dict(r) for r in rows]}


HANDLERS: dict[str, CustomToolHandler] = {
    "polar_lookup_customer_by_email": _lookup_customer_by_email,
    "polar_lookup_organization": _lookup_organization,
    "polar_recent_orders": _recent_orders,
    "polar_recent_subscriptions": _recent_subscriptions,
}


def _prompt_confirmation(tool_name: str, tool_input: Any) -> tuple[str, str | None]:
    # CLI-level confirmation. Replace with a Slack approval / web UI if
    # you want unattended operation.
    print(f"\n[confirm] agent wants to call MCP tool: {tool_name}")
    print(f"[confirm] input: {tool_input!r}")
    answer = input("[confirm] allow? [y/N/reason-to-deny] ").strip()
    if answer.lower() in {"y", "yes"}:
        return "allow", None
    if answer == "" or answer.lower() in {"n", "no"}:
        return "deny", "Human reviewer declined."
    return "deny", answer


async def run(thread_id: str) -> None:
    import os

    agent_id = os.environ["POLAR_MANAGED_AGENT_ID"]
    env_id = os.environ["POLAR_MANAGED_ENV_ID"]
    vault_id = os.environ["POLAR_MANAGED_VAULT_ID"]
    dsn = os.environ["POLAR_MANAGED_READ_DSN"]

    client = AsyncAnthropic()
    pool = await asyncpg.create_pool(
        dsn=dsn, min_size=1, max_size=2, command_timeout=15
    )

    try:
        session = await client.beta.sessions.create(
            agent=agent_id,
            environment_id=env_id,
            vault_ids=[vault_id],
            title=f"Triage {thread_id}",
        )
        print(f"session: https://platform.claude.com/workspaces/default/sessions/{session.id}")

        # Stream-first: open stream BEFORE sending the kickoff so we
        # don't miss early events.
        stream = await client.beta.sessions.events.stream(session.id)
        await client.beta.sessions.events.send(
            session.id,
            events=[
                {
                    "type": "user.message",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                f"Triage Plain thread {thread_id}. Read it "
                                f"with getThreadDetails, look the customer "
                                f"up in Polar's DB, then post one internal "
                                f"note with a summary + draft reply. Do not "
                                f"reply to the customer."
                            ),
                        }
                    ],
                }
            ],
        )

        async for event in stream:
            # The orchestrator only acts on the events it owns. The
            # SSE stream also includes agent.message / span.* events for
            # observability; we print a small breadcrumb for each.
            etype = getattr(event, "type", None)

            if etype == "agent.message":
                for block in getattr(event, "content", []):
                    if getattr(block, "type", None) == "text":
                        print(block.text, end="", flush=True)

            elif etype == "agent.custom_tool_use":
                result = await _handle_custom_tool(event, pool)
                await client.beta.sessions.events.send(
                    session.id,
                    events=[
                        {
                            "type": "user.custom_tool_result",
                            "custom_tool_use_id": event.id,
                            "content": [{"type": "text", "text": result}],
                        }
                    ],
                )

            elif (
                etype == "agent.mcp_tool_use"
                and getattr(event, "evaluated_permission", None) == "ask"
            ):
                tool_name = getattr(event, "name", "")
                if tool_name in DENY_TOOLS:
                    print(f"\n[deny] {tool_name} is on the orchestrator denylist")
                    await client.beta.sessions.events.send(
                        session.id,
                        events=[
                            {
                                "type": "user.tool_confirmation",
                                "tool_use_id": event.id,
                                "result": "deny",
                                "deny_message": (
                                    "This tool is disallowed by the "
                                    "orchestrator. Use createNote with "
                                    "the draft inline instead."
                                ),
                            }
                        ],
                    )
                    continue

                if tool_name in AUTO_APPROVE_READS:
                    decision, deny_message = "allow", None
                else:
                    decision, deny_message = _prompt_confirmation(
                        tool_name, getattr(event, "input", None)
                    )
                payload: dict[str, Any] = {
                    "type": "user.tool_confirmation",
                    "tool_use_id": event.id,
                    "result": decision,
                }
                if deny_message:
                    payload["deny_message"] = deny_message
                await client.beta.sessions.events.send(
                    session.id, events=[payload]
                )

            elif etype == "session.status_terminated":
                print("\n[session terminated]")
                break

            elif etype == "session.status_idle":
                stop_reason = getattr(event, "stop_reason", None)
                if stop_reason and getattr(stop_reason, "type", "") != "requires_action":
                    print("\n[session idle, stop_reason="
                          f"{getattr(stop_reason, 'type', '?')}]")
                    break

    finally:
        await pool.close()
        await client.close()


async def _handle_custom_tool(event: Any, pool: asyncpg.Pool) -> str:
    import json

    name = getattr(event, "name", "")
    tool_input = getattr(event, "input", {}) or {}
    handler = HANDLERS.get(name)
    if handler is None:
        return json.dumps({"error": f"unknown custom tool: {name}"})
    try:
        result = await handler(tool_input, pool)
        return json.dumps(result, default=str)
    except Exception as exc:
        return json.dumps({"error": type(exc).__name__, "detail": str(exc)})


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: python -m polar.managed_agents.triage <plain_thread_id>")
        sys.exit(2)
    asyncio.run(run(sys.argv[1]))


if __name__ == "__main__":
    main()
