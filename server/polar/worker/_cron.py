import datetime
from collections.abc import Iterable
from typing import Any

from apscheduler.triggers.cron import CronTrigger as _CronTrigger


class CronTrigger(_CronTrigger):
    """APScheduler's `CronTrigger`, pinned to UTC.

    Upstream resolves an unspecified timezone to the machine's local one, which makes
    every schedule depend on the host's `TZ`. Polar expresses all of them in UTC.
    """

    def __init__(self, *args: Any, timezone: Any = None, **kwargs: Any) -> None:
        super().__init__(*args, timezone=timezone or datetime.UTC, **kwargs)


class MaintenanceWindow:
    """A daily job assigned a slot between 04:00 and 05:00 UTC."""


def resolve_cron_triggers(
    triggers: Iterable[tuple[str, CronTrigger | MaintenanceWindow]],
) -> dict[str, CronTrigger]:
    declarations = dict(triggers)
    maintenance_jobs = sorted(
        name
        for name, trigger in declarations.items()
        if isinstance(trigger, MaintenanceWindow)
    )
    if len(maintenance_jobs) >= 60:
        raise ValueError("The daily maintenance window has no free slots")

    resolved = {
        name: trigger
        for name, trigger in declarations.items()
        if isinstance(trigger, CronTrigger)
    }
    resolved.update(
        (
            name,
            CronTrigger(hour=4, minute=(index + 1) * 60 // (len(maintenance_jobs) + 1)),
        )
        for index, name in enumerate(maintenance_jobs)
    )
    return resolved
