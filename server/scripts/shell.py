import asyncio
import atexit
import logging.config
import os
import sys
from typing import Any

import dramatiq
import rich
import structlog

from polar import tasks  # noqa: F401
from polar.kit.db.postgres import create_async_sessionmaker
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.worker import JobQueueManager

"""
This script allows interacting with the database and our services in a REPL.
Similar to how the `django shell` or `flask shell` commands work.

I allows you to:

>>> customer_repository = CustomerRepository.from_session(session)
>>> stmt = customer_repository.get_base_statement().where(Customer.email == 'test+customer045@polar.sh')
>>> await customer_repository.get_one_or_none(stmt)
"""


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


structlog.configure(processors=[drop_all])
logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": True,
    }
)


def shell_asyncio(loop: asyncio.AbstractEventLoop, **namespace: object) -> None:
    # FROM: https://github.com/python/cpython/blob/v3.12.0/Lib/asyncio/__main__.py
    import asyncio.__main__ as aio_main
    from asyncio.__main__ import AsyncIOInteractiveConsole, REPLThread

    imported_objects = {
        **namespace,
        "asyncio": asyncio,
        "__name__": "__main__",
        "__package__": None,
        "__builtins__": __builtins__,
    }
    console = AsyncIOInteractiveConsole(imported_objects, loop)

    # Wire globals in asyncio.__main__ that REPLThread expects
    if os.getenv("PYTHON_BASIC_REPL"):
        aio_main.CAN_USE_PYREPL = False
    else:
        from _pyrepl.main import CAN_USE_PYREPL

        aio_main.CAN_USE_PYREPL = CAN_USE_PYREPL
    aio_main.console = console
    aio_main.loop = loop
    aio_main.return_code = 0
    aio_main.repl_future = None
    aio_main.keyboard_interrupted = False

    readline: object | None
    try:
        import readline
    except ImportError:
        readline = None

    interactive_hook = getattr(sys, "__interactivehook__", None)

    if interactive_hook is not None:
        sys.audit("cpython.run_interactivehook", interactive_hook)
        interactive_hook()

    repl_thread = REPLThread(name="Interactive thread")
    repl_thread.daemon = True
    repl_thread.start()

    while True:
        try:
            loop.run_forever()
        except KeyboardInterrupt:
            aio_main.keyboard_interrupted = True
            if aio_main.repl_future and not aio_main.repl_future.done():
                aio_main.repl_future.cancel()
            repl_thread.interrupt()
            continue
        else:
            break


def start_shell() -> None:
    rich.print("""
[bold cyan]Welcome to the Polar shell![/bold cyan]

[bold yellow]Important notes:[/bold yellow]

- The session is [bold red]not[/bold red] automatically committed. You need to call [bold green]`await session.commit()`[/bold green] to persist changes.
- The enqueued jobs are [bold red]not[/bold red] automatically flushed. You need to call [bold green]`await job_queue_manager.flush(broker, redis)`[/bold green] to flush the jobs to the queue.
""")

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    redis = create_redis("app")
    job_queue_manager = JobQueueManager.set()
    engine = create_async_engine("script")
    async_sessionmaker = create_async_sessionmaker(engine)
    session = async_sessionmaker()

    def _cleanup(loop: asyncio.AbstractEventLoop) -> None:
        try:
            loop.run_until_complete(session.close())
            loop.run_until_complete(engine.dispose())
            loop.run_until_complete(redis.close())
            loop.close()
        except Exception as e:
            print(f"cleanup failed: {e!r}")

    atexit.register(_cleanup, loop)
    return shell_asyncio(
        loop=loop,
        session=session,
        job_queue_manager=job_queue_manager,
        redis=redis,
        broker=dramatiq.get_broker(),
    )


if __name__ == "__main__":
    start_shell()
