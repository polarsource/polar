import calendar
from datetime import datetime

from dateutil.relativedelta import relativedelta

from polar.enums import RecurringInterval


def get_next_anchor(
    interval: RecurringInterval,
    after: datetime,
    anchor_day: int,
    anchor_month: int | None = None,
) -> datetime:
    """The first anchor date strictly after `after`, keeping its time of day.

    `anchor_day` is the ISO weekday (1-7) for `week`, the day of month (1-31)
    for `month` and `year`, clamped to the month's length. `year` also needs
    `anchor_month`. `day` has no anchor: every day is one.
    """
    match interval:
        case RecurringInterval.day:
            return after + relativedelta(days=1)
        case RecurringInterval.week:
            if not 1 <= anchor_day <= 7:
                raise ValueError(f"Invalid weekly anchor day: {anchor_day}")
            days = (anchor_day - after.isoweekday() - 1) % 7 + 1
            return after + relativedelta(days=days)
        case RecurringInterval.month:
            if not 1 <= anchor_day <= 31:
                raise ValueError(f"Invalid monthly anchor day: {anchor_day}")
            candidate = _on_day(after, after.year, after.month, anchor_day)
            if candidate > after:
                return candidate
            following = after.replace(day=1) + relativedelta(months=1)
            return _on_day(after, following.year, following.month, anchor_day)
        case RecurringInterval.year:
            if anchor_month is None or not 1 <= anchor_month <= 12:
                raise ValueError(f"Invalid yearly anchor month: {anchor_month}")
            if not 1 <= anchor_day <= calendar.monthrange(2000, anchor_month)[1]:
                raise ValueError(f"Invalid yearly anchor day: {anchor_day}")
            candidate = _on_day(after, after.year, anchor_month, anchor_day)
            if candidate > after:
                return candidate
            return _on_day(after, after.year + 1, anchor_month, anchor_day)


def _on_day(d: datetime, year: int, month: int, day: int) -> datetime:
    _, max_month_day = calendar.monthrange(year, month)
    return d.replace(year=year, month=month, day=min(day, max_month_day))
