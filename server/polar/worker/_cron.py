import datetime
from typing import Any

from apscheduler.triggers.cron import CronTrigger as _CronTrigger


class CronTrigger(_CronTrigger):
    """APScheduler's `CronTrigger`, pinned to UTC.

    Upstream resolves an unspecified timezone to the machine's local one, which makes
    every schedule depend on the host's `TZ`. Polar expresses all of them in UTC.
    """

    def __init__(self, *args: Any, timezone: Any = None, **kwargs: Any) -> None:
        super().__init__(*args, timezone=timezone or datetime.UTC, **kwargs)
