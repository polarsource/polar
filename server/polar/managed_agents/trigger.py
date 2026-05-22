"""Local trigger for the Plain triage Managed Agent.

Bypasses the Plain webhook flow — useful when you don't have a Plain
webhook configured (or you don't want one yet) but want to exercise
the agent + worker end-to-end against a real or synthetic thread id.

Usage:

    uv run python -m polar.managed_agents.trigger <plain_thread_id>

The script reuses webhook.trigger_triage() so the kickoff message and
session metadata are identical to what a real webhook delivery would
produce — the worker can't tell the difference.

Requires the same env as the webhook host: ANTHROPIC_API_KEY,
POLAR_MANAGED_AGENT_ID, POLAR_MANAGED_ENV_ID, POLAR_MANAGED_VAULT_ID.
"""

from __future__ import annotations

import asyncio
import sys

from polar.config import settings
from polar.managed_agents.webhook import trigger_triage


async def main(thread_id: str) -> None:
    missing = [
        name
        for name, value in [
            ("ANTHROPIC_API_KEY", settings.ANTHROPIC_API_KEY),
            ("POLAR_MANAGED_AGENT_ID", settings.POLAR_MANAGED_AGENT_ID),
            ("POLAR_MANAGED_ENV_ID", settings.POLAR_MANAGED_ENV_ID),
            ("POLAR_MANAGED_VAULT_ID", settings.POLAR_MANAGED_VAULT_ID),
        ]
        if not value
    ]
    if missing:
        raise SystemExit(f"missing env: {', '.join(missing)}")

    session_id = await trigger_triage(thread_id)
    print(f"queued session: {session_id}")
    print(
        f"watch: https://platform.claude.com/workspaces/default/"
        f"sessions/{session_id}"
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(
            "usage: python -m polar.managed_agents.trigger <plain_thread_id>"
        )
        sys.exit(2)
    asyncio.run(main(sys.argv[1]))
