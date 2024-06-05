from datetime import datetime
from enum import StrEnum

from sqlalchemy import Function, SQLColumnExpression, TextClause, func, text


class Interval(StrEnum):
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
