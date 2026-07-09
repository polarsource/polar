from polar.exceptions import PolarTaskError
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    enqueue_job,
)

from .rules import INVARIANTS
from .service import invariant as invariant_service


class InvariantTaskError(PolarTaskError):
    """Base class for invariant task errors."""


class InvariantDoesNotExistError(InvariantTaskError):
    """Raised when an invariant class does not exist."""

    def __init__(self, invariant_cls_name: str):
        super().__init__(f"Invariant class {invariant_cls_name} does not exist.")


@actor(
    actor_name="observability.invariants.enqueue",
    priority=TaskPriority.LOW,
    max_retries=0,
    cron_trigger=CronTrigger.from_crontab("*/15 * * * *"),
)
async def enqueue_invariants() -> None:
    for invariant_cls in INVARIANTS:
        invariant_identifier = (
            f"{invariant_cls.__module__}.{invariant_cls.__qualname__}"
        )
        enqueue_job("observability.invariants.check", invariant_identifier)


@actor(
    actor_name="observability.invariants.check",
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def check_invariant(invariant_cls_name: str) -> None:
    try:
        invariant_cls = next(
            cls
            for cls in INVARIANTS
            if f"{cls.__module__}.{cls.__qualname__}" == invariant_cls_name
        )
    except StopIteration as e:
        raise InvariantDoesNotExistError(invariant_cls_name) from e

    async with AsyncSessionMaker() as session:
        await invariant_service.check(session, invariant_cls)
