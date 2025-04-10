from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    CTE,
    Function,
    SQLColumnExpression,
    TextClause,
    cte,
    func,
    select,
    text,
)


class TimeInterval(StrEnum):
    year = "year"
    month = "month"
    week = "week"
    day = "day"
    hour = "hour"

    def sql_interval(self) -> TextClause:
        return text(f"'1 {self.value}'::interval")

    def sql_date_trunc(
        self, column: SQLColumnExpression[datetime] | datetime
    ) -> Function[datetime]:
        return func.date_trunc(self.value, column)


def get_timestamp_series_cte(
    start_timestamp: datetime, end_timestamp: datetime, interval: TimeInterval
) -> CTE:
    return cte(
        select(
            func.generate_series(
                start_timestamp, end_timestamp, interval.sql_interval()
            ).column_valued("timestamp")
        )
    )


MIN_DATETIME = datetime(2023, 1, 1)  # Before that, Polar didn't even exist! 🚀
MIN_DATE = MIN_DATETIME.date()

MAX_INTERVAL_DAYS: dict[TimeInterval, int] = {
    TimeInterval.hour: 7,
    TimeInterval.day: 366,
    TimeInterval.week: 365,
    TimeInterval.month: 365 * 4,
    TimeInterval.year: 365 * 10,
}


def is_under_limits(start_date: date, end_date: date, interval: TimeInterval) -> bool:
    return end_date.toordinal() - start_date.toordinal() <= MAX_INTERVAL_DAYS[interval]
