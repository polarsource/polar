# transform APScheduler cron jobs into Vercel crons format

import sys
from collections.abc import Callable
from typing import Any

from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.cron.fields import BaseField

from polar import tasks  # noqa: F401 - ensure all actors are registered

from ._broker import scheduler_middleware

_CRONTAB_FIELDS = ("minute", "hour", "day", "month", "day_of_week")


def _expr_to_str(expr: Any, remap: Callable[[int], int] | None = None) -> str:
    if not hasattr(expr, "first"):
        s = "*"
    else:
        first = remap(expr.first) if remap else expr.first
        last = remap(expr.last) if remap else expr.last
        if last != first:
            s = f"{first}-{last}"
        else:
            s = str(first)
    if expr.step:
        s += f"/{expr.step}"
    return s


def _field_to_str(field: BaseField, remap: Callable[[int], int] | None = None) -> str:
    return ",".join(_expr_to_str(e, remap) for e in field.expressions)


def _apscheduler_dow_to_posix(n: int) -> int:
    """APScheduler: mon=0..sun=6 -> POSIX: sun=0..sat=6"""
    return (n + 1) % 7


def trigger_to_crontab(trigger: CronTrigger) -> str:
    fields = {f.name: f for f in trigger.fields}
    parts = []
    for name in _CRONTAB_FIELDS:
        remap = _apscheduler_dow_to_posix if name == "day_of_week" else None
        parts.append(_field_to_str(fields[name], remap))
    return " ".join(parts)


_THIS_MODULE = sys.modules[__name__]


def _send_attr_name(actor_name: str) -> str:
    return "send_" + actor_name.replace(".", "_").replace("-", "_")


# Expose each cron actor's bound `send` method as a module-level attribute so
# the Vercel cron service can invoke it directly
for _send_fn, _ in scheduler_middleware.cron_triggers:
    _actor = _send_fn.__self__  # type: ignore[attr-defined]
    setattr(_THIS_MODULE, _send_attr_name(_actor.actor_name), _send_fn)


class CronTab:
    def get_crons(self) -> list[tuple[str, str]]:
        result = []
        for send_fn, trigger in scheduler_middleware.cron_triggers:
            actor = send_fn.__self__  # type: ignore[attr-defined]
            schedule = trigger_to_crontab(trigger)
            result.append(
                (
                    f"{__spec__.name}:{_send_attr_name(actor.actor_name)}",
                    schedule,
                )
            )
        return result


crontab = CronTab()


if __name__ == "__main__":
    for name, sched in crontab.get_crons():
        print(f"{name:70s} {sched}")  # noqa: T201
