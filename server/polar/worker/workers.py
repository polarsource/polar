from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from polar import tasks as _tasks  # noqa: F401  # Import tasks for side‑effect actor registration
from polar.worker import _set_retry_context_from_metadata
from polar.worker.registry import ACTOR_FUNCS, ACTOR_MAX_RETRIES
from vercel.workers import MessageMetadata, subscribe


def _dispatch(message: Any, metadata: MessageMetadata) -> Any:
    """
    Dispatch a queue message to the appropriate task function.

    The producer encodes messages as:
      { "actor": "<name>", "args": [...], "kwargs": {...} }
    """
    # Temporary debug logging to investigate malformed queue messages.
    # Note: use print() here so logs also appear when running under the
    # minimal WSGI server used by vercel.workers.wsgi_app.
    print(
        "polar.worker._dispatch received message:",
        repr(message),
        "metadata:",
        dict(metadata or {}),
    )

    if not isinstance(message, Mapping) or "actor" not in message:
        print(
            "polar.worker._dispatch invalid message shape:",
            repr(message),
            "metadata:",
            dict(metadata or {}),
        )
        raise ValueError("Invalid worker message: missing 'actor' field")

    actor_name = str(message["actor"])
    fn = ACTOR_FUNCS.get(actor_name)
    if fn is None:
        raise LookupError(f"Unknown worker actor: {actor_name}")

    args = list(message.get("args") or [])
    kwargs_raw = message.get("kwargs") or {}
    if not isinstance(kwargs_raw, Mapping):
        raise ValueError("Invalid worker message: 'kwargs' must be a mapping")
    kwargs = dict(kwargs_raw)

    # Expose deliveryCount to tasks that use get_retries()/can_retry().
    _set_retry_context_from_metadata(
        metadata.get("deliveryCount"), ACTOR_MAX_RETRIES.get(actor_name)
    )

    # The function may be async; vercel.workers.wsgi_app will take care of
    # awaiting the coroutine via asyncio.run() when necessary.
    return fn(*args, **kwargs)


@subscribe(topic="high_priority", consumer="default")
def high_priority_worker(message: Any, metadata: MessageMetadata) -> Any:
    return _dispatch(message, metadata)


@subscribe(topic="default", consumer="default")
def default_worker(message: Any, metadata: MessageMetadata) -> Any:
    return _dispatch(message, metadata)
