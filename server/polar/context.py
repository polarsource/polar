from contextvars import ContextVar
from typing import ClassVar, Type, Optional
from types import TracebackType


class PolarContext:
    pass


class ExecutionContext:
    _contextvar: ClassVar[ContextVar] = ContextVar("ExecutionContext") # type: ignore

    # is_during_installation is True this is an event (or request) triggered by the app
    # or repository installation flow.
    #
    # It allows us to, for example, prevent creating notifications for objects
    # found during the initial syncing.
    is_during_installation: bool

    def __init__(self, is_during_installation: bool = False) -> None:
        self.is_during_installation = is_during_installation

    def __enter__(self) -> "ExecutionContext":
        self.token = ExecutionContext._contextvar.set(self)
        return self

    # def __exit__(self, type_, value, traceback) -> None:
    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc: Optional[BaseException],
        traceback: Optional[TracebackType],
    ) -> None:
        ExecutionContext._contextvar.reset(self.token)

    @staticmethod
    def current() -> "ExecutionContext":
        """Returns the current ExecutionContext, or a clean one if there's no current
        context."""
        return ExecutionContext._contextvar.get(ExecutionContext())
