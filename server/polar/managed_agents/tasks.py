"""Background jobs for the managed-agents triage flow.

The Plain webhook handler (`webhook.py`) enqueues `plain_triage` jobs;
this worker picks them up and runs the Managed Agent session
unattended.
"""

from polar.managed_agents.triage import run as triage_run
from polar.worker import TaskPriority, actor


@actor(actor_name="managed_agents.plain_triage", priority=TaskPriority.LOW)
async def plain_triage(thread_id: str) -> None:
    await triage_run(thread_id, interactive=False)
