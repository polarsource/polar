from datetime import date

from polar.kit.time_queries import TimeInterval

MIN_DATE = date(2023, 1, 1)  # Before that, Polar didn't even exist! 🚀

MAX_INTERVAL_DAYS: dict[TimeInterval, int] = {
    TimeInterval.hour: 7,
    TimeInterval.day: 366,
    TimeInterval.week: 365,
    TimeInterval.month: 365 * 4,
    TimeInterval.year: 365 * 10,
}


def is_under_limits(start_date: date, end_date: date, interval: TimeInterval) -> bool:
    return end_date.toordinal() - start_date.toordinal() <= MAX_INTERVAL_DAYS[interval]
