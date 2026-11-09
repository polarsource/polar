from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import anyio
from anyio.abc import TaskGroup


@asynccontextmanager
async def create_task_group() -> AsyncIterator[TaskGroup]:
    """anyio task group that raises a single failure unwrapped."""
    try:
        async with anyio.create_task_group() as tg:
            yield tg
    except BaseExceptionGroup as eg:
        if len(eg.exceptions) != 1:
            raise
        error = eg.exceptions[0]
    else:
        return
    raise error
