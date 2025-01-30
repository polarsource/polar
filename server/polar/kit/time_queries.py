from datetime import datetime
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
        self, column: SQLColumnExpression[datetime]
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
