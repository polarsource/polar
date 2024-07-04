from datetime import date

from .queries import Interval

MIN_DATE = date(2023, 1, 1)  # Before that, Polar didn't even exist! 🚀

MAX_INTERVAL_DAYS: dict[Interval, int] = {
    Interval.hour: 7,
    Interval.day: 366,
    Interval.week: 365,
    Interval.month: 365 * 4,
    Interval.year: 365 * 10,
}


def is_under_limits(start_date: date, end_date: date, interval: Interval) -> bool:
    return end_date.toordinal() - start_date.toordinal() <= MAX_INTERVAL_DAYS[interval]
