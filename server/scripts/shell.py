import asyncio
import atexit
import logging.config
import re
import sys
import traceback
from collections import defaultdict
from collections.abc import Coroutine
from importlib import import_module
from typing import Any, Never

import dramatiq
import structlog
from sqlalchemy.orm import sessionmaker

from polar.config import settings
from polar.kit.db.postgres import AsyncSession, create_async_engine
from polar.redis import create_redis
from polar.worker import JobQueueManager

"""
This script allows interacting with the database and our services in a REPL.
Similar to how the `django shell` or `flask shell` commands work.

I allows you to:

>>> customer_repository = CustomerRepository.from_session(session)
>>> stmt = customer_repository.get_base_statement().where(Customer.email == 'test+customer045@polar.sh')
>>> await customer_repository.get_one_or_none(stmt)

My personal favorite Python shell is `ptpython` which can be installed with
the command `uv pip install ptpython`.
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

type Namespace = dict[str, object]


def cached_import(module_path: str, class_name: str) -> object:
    # Check whether module is loaded and fully initialized.
    if not (
        (module := sys.modules.get(module_path))
        and (spec := getattr(module, "__spec__", None))
        and getattr(spec, "_initializing", False) is False
    ):
        module = import_module(module_path)
    return getattr(module, class_name)


def import_dotted_path(dotted_path: str) -> object:
    """
    Import a dotted module path and return the attribute/class designated by
    the last name in the path. Raise ImportError if the import failed.
    """
    try:
        module_path, class_name = dotted_path.rsplit(".", 1)
    except ValueError as err:
        raise ImportError(f"{dotted_path} doesn't look like a module path") from err

    try:
        return cached_import(module_path, class_name)
    except AttributeError as err:
        raise ImportError(
            f'Module "{module_path}" does not define a "{class_name}" attribute/class'
        ) from err


RE_IMPORT_AS = re.compile(r"^from ([^ ]+) import ([^ ]+) as ([^ ]+)$")


def get_namespace() -> Namespace:  # (**options):
    verbosity = 3  # options["verbosity"]

    default_imports = [
        "sqlalchemy",
        "polar.models.order.Order",
        "polar.models.customer.Customer",
        # "from polar.customer.repository import CustomerRepository as customer_repository",
        # "from polar.order.repository import OrderRepository as order_repository",
        # "from polar.payment.repository import PaymentRepository as payment_repository",
        "polar.customer.repository.CustomerRepository",
        "polar.order.repository.OrderRepository",
        "polar.payment.repository.PaymentRepository",
        "from polar.order.service import order as order_service",
    ]

    path_imports = default_imports
    if path_imports is None:
        return {}

    auto_imports: defaultdict[object, list[tuple[str, object]]] = defaultdict(list)
    import_errors = []
    for path in path_imports:
        orig_path = path
        match = RE_IMPORT_AS.match(path)
        str_object = None
        alias = None
        if match:
            path = f"{match.group(1)}.{match.group(2)}"
            str_object = match.group(2)
            alias = match.group(3)

        try:
            obj = import_dotted_path(path) if "." in path else import_module(path)
        except ImportError as e:
            if verbosity >= 2:
                print(f"Failed to import {orig_path}: {e}")
            import_errors.append(orig_path)
            continue

        if "." in path:
            module, name = path.rsplit(".", 1)
        else:
            module = None
            name = path
        if (name, obj) not in auto_imports[module]:
            if alias:
                auto_imports[module].append((alias, obj))
            else:
                auto_imports[module].append((name, obj))

    namespace = {name: obj for items in auto_imports.values() for name, obj in items}

    if verbosity < 1:
        return namespace

    errors = len(import_errors)
    if errors:
        msg = "\n".join(f"  {e}" for e in import_errors)
        objects = "objects" if errors != 1 else "object"
        print(
            f"{errors} {objects} could not be automatically imported:\n\n{msg}",
            end="\n\n",
        )

    amount = len(namespace)
    objects_str = "objects" if amount != 1 else "object"
    msg = f"{amount} {objects_str} imported automatically"

    if verbosity < 2:
        if amount:
            msg += " (use -v 2 for details)"
        print(f"{msg}.", end="\n\n")
        return namespace

    top_level = auto_imports.pop(None, [])
    import_string = "\n".join(
        [f"  import {obj}" for obj, _ in top_level]
        + [
            f"  from {module} import {objects}"
            for module, imported_objects in auto_imports.items()
            if (objects := ", ".join(i[0] for i in imported_objects))
        ]
    )

    try:
        import isort
    except ImportError:
        pass
    else:
        import_string = isort.code(import_string)

    if import_string:
        msg = f"{msg}:\n\n{import_string}"
    else:
        msg = f"{msg}."

    print(msg, end="\n\n")

    return namespace


def shell_ipython(
    loop: asyncio.AbstractEventLoop,
    namespace: Namespace,
    session: AsyncSession | None = None,
    options: None = None,
) -> None:
    from IPython import start_ipython

    imported_objects: Namespace = {
        **namespace,
        **get_namespace(),
    }

    start_ipython(argv=[], user_ns=imported_objects)


def shell_bpython(
    loop: asyncio.AbstractEventLoop,
    namespace: Namespace,
    session: AsyncSession | None = None,
    options: None = None,
) -> None:
    import bpython

    imported_objects: Namespace = {
        **namespace,
        **get_namespace(),
    }

    bpython.embed(imported_objects)


def shell_asyncio(
    loop: asyncio.AbstractEventLoop,
    namespace: Namespace,
    session: AsyncSession | None = None,
    options: None = None,
) -> None:
    # FROM: https://github.com/python/cpython/blob/v3.12.0/Lib/asyncio/__main__.py
    import asyncio.__main__ as aio_main
    from asyncio.__main__ import AsyncIOInteractiveConsole, REPLThread

    imported_objects = {
        **namespace,
        "session": session,
        **get_namespace(),
        "asyncio": asyncio,
        "__name__": "__main__",
        "__package__": None,
        "__builtins__": __builtins__,
    }
    console = AsyncIOInteractiveConsole(imported_objects, loop)

    # Wire globals in asyncio.__main__ that REPLThread expects
    aio_main.console = console
    aio_main.loop = loop
    aio_main.return_code = 0
    aio_main.repl_future = None
    aio_main.keyboard_interrupted = False

    readline: object | None
    try:
        import readline  # NoQA
    except ImportError:
        readline = None

    interactive_hook = getattr(sys, "__interactivehook__", None)

    if interactive_hook is not None:
        sys.audit("cpython.run_interactivehook", interactive_hook)
        interactive_hook()

    # if interactive_hook is site.register_readline:
    #     # Fix the completer function to use the interactive console locals
    #     try:
    #         import rlcompleter
    #     except:
    #         pass
    #     else:
    #         if readline is not None:
    #             completer = rlcompleter.Completer(console.locals)
    #             readline.set_completer(completer.complete)

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


def shell_python(
    loop: asyncio.AbstractEventLoop,
    namespace: Namespace,
    session: AsyncSession | None = None,
    options: None = None,
) -> None:
    import code

    # Set up a dictionary to serve as the environment for the shell.
    imported_objects = {
        **namespace,
        "session": session,
        **get_namespace(),
    }  # **options)
    # imported_objects = {}

    # We want to honor both $PYTHONSTARTUP and .pythonrc.py, so follow
    # system conventions and get $PYTHONSTARTUP first then .pythonrc.py.
    # if not options["no_startup"]:
    #     for pythonrc in OrderedSet(
    #         [os.environ.get("PYTHONSTARTUP"), os.path.expanduser("~/.pythonrc.py")]
    #     ):
    #         if not pythonrc:
    #             continue
    #         if not os.path.isfile(pythonrc):
    #             continue
    #         with open(pythonrc) as handle:
    #             pythonrc_code = handle.read()
    #         # Match the behavior of the cpython shell where an error in
    #         # PYTHONSTARTUP prints an exception and continues.
    #         try:
    #             exec(compile(pythonrc_code, pythonrc, "exec"), imported_objects)
    #         except Exception:
    #             traceback.print_exc()

    # By default, this will set up readline to do tab completion and to
    # read and write history to the .python_history file, but this can be
    # overridden by $PYTHONSTARTUP or ~/.pythonrc.py.
    try:
        hook = sys.__interactivehook__  # type: ignore
    except AttributeError:
        # Match the behavior of the cpython shell where a missing
        # sys.__interactivehook__ is ignored.
        pass
    else:
        try:
            hook()
        except Exception:
            # Match the behavior of the cpython shell where an error in
            # sys.__interactivehook__ prints a warning and the exception
            # and continues.
            print("Failed calling sys.__interactivehook__")
            traceback.print_exc()

    # Set up tab completion for objects imported by $PYTHONSTARTUP or
    # ~/.pythonrc.py.
    try:
        import readline
        import rlcompleter

        readline.set_completer(rlcompleter.Completer(imported_objects).complete)
    except ImportError:
        pass

    # Start the interactive interpreter.
    code.interact(local=imported_objects)


SHELLS = [
    shell_ipython,
    shell_bpython,
    shell_asyncio,
    # shell_python,
]


def start_shell() -> None:
    print("""
customer_repository = CustomerRepository.from_session(session)
stmt = customer_repository.get_base_statement().where(Customer.email == 'test+customer045@polar.sh')
await customer_repository.get_one_or_none(stmt)
""")

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def iawait(expr: Coroutine[Any, Any, Never]) -> Any:
        return asyncio.run_coroutine_threadsafe(expr, loop).result()

    # def iawait(expr):
    #     return loop.run_until_complete(expr)

    namespace = {
        "loop": loop,
        "iawait": iawait,
    }

    redis = create_redis("app")
    JobQueueManager.open(dramatiq.get_broker(), redis)
    engine = create_async_engine(
        dsn=str(settings.get_postgres_dsn("asyncpg")),
        pool_size=5,
        pool_recycle=3600,
    )
    # engine.begin()
    _Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)  # type: ignore
    session = _Session()

    def _cleanup() -> None:
        try:
            loop = asyncio.get_event_loop()
            loop.run_until_complete(session.close())
            loop.run_until_complete(engine.dispose())
        except Exception as e:
            print(f"cleanup failed: {e!r}")

    atexit.register(_cleanup)

    for shell in SHELLS:
        try:
            return shell(
                loop=loop, session=session, namespace={**namespace, "session": session}
            )
        except ImportError:
            pass
    raise ValueError(f"Couldn't import {shell} interface.")


if __name__ == "__main__":
    start_shell()
