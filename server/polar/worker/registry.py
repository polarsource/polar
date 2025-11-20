from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

ActorCallable = Callable[..., Awaitable[Any]]

# Mapping from actor name (e.g. "order.invoice") to the async function
ACTOR_FUNCS: dict[str, ActorCallable] = {}

# Mapping from actor name to queue name (e.g. "high_priority" or "default")
ACTOR_QUEUES: dict[str, str] = {}

# Mapping from actor name to its max retries (if specified)
ACTOR_MAX_RETRIES: dict[str, int] = {}

# Cron-registered actors (actor name + trigger)
CRON_JOBS: list[tuple[str, Any]] = []


def register_actor(
    actor_name: str,
    queue_name: str,
    fn: ActorCallable,
    *,
    cron_trigger: Any | None = None,
    max_retries: int | None = None,
) -> None:
    """Register an actor function and its associated metadata.

    This is used by the Vercel worker glue code to dispatch incoming
    queue messages to the correct async function, by the enqueue
    helpers to determine which queue to send a job to, and by the
    cron scheduler to know which actors should be enqueued on a
    schedule.
    """
    ACTOR_FUNCS[actor_name] = fn
    ACTOR_QUEUES[actor_name] = queue_name

    if max_retries is not None:
        ACTOR_MAX_RETRIES[actor_name] = max_retries

    if cron_trigger is not None:
        CRON_JOBS.append((actor_name, cron_trigger))


