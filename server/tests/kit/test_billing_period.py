from datetime import UTC, datetime

import pytest

from polar.enums import RecurringInterval
from polar.kit.billing_period import get_next_anchor


def dt(year: int, month: int, day: int, hour: int = 12) -> datetime:
    return datetime(year, month, day, hour, tzinfo=UTC)


class TestGetNextAnchor:
    def test_day(self) -> None:
        assert get_next_anchor(RecurringInterval.day, dt(2024, 2, 28), 15) == dt(
            2024, 2, 29
        )
        assert get_next_anchor(RecurringInterval.day, dt(2024, 12, 31), 15) == dt(
            2025, 1, 1
        )

    @pytest.mark.parametrize(
        ("after", "anchor_day", "expected"),
        [
            (dt(2026, 11, 24), 4, dt(2026, 11, 26)),  # Tuesday -> Thursday
            (dt(2026, 11, 24), 1, dt(2026, 11, 30)),  # Tuesday -> next Monday
            (dt(2026, 11, 24), 2, dt(2026, 12, 1)),  # on the anchor -> next week
            (dt(2026, 12, 29), 5, dt(2027, 1, 1)),  # across the year
        ],
    )
    def test_week(self, after: datetime, anchor_day: int, expected: datetime) -> None:
        assert get_next_anchor(RecurringInterval.week, after, anchor_day) == expected

    @pytest.mark.parametrize(
        ("after", "anchor_day", "expected"),
        [
            (dt(2026, 3, 10), 15, dt(2026, 3, 15)),
            (dt(2026, 3, 20), 15, dt(2026, 4, 15)),
            (dt(2026, 12, 20), 15, dt(2027, 1, 15)),
            # Day 31 clamps to the month's length.
            (dt(2026, 4, 10), 31, dt(2026, 4, 30)),
            (dt(2026, 1, 31), 31, dt(2026, 2, 28)),
            (dt(2024, 1, 31), 31, dt(2024, 2, 29)),
            (dt(2026, 2, 28), 31, dt(2026, 3, 31)),
            (dt(2026, 4, 30), 31, dt(2026, 5, 31)),
            # Day 30 and 29 in February.
            (dt(2026, 2, 1), 30, dt(2026, 2, 28)),
            (dt(2024, 2, 1), 29, dt(2024, 2, 29)),
            (dt(2025, 2, 1), 29, dt(2025, 2, 28)),
            (dt(2026, 1, 1), 1, dt(2026, 2, 1)),
        ],
    )
    def test_month(self, after: datetime, anchor_day: int, expected: datetime) -> None:
        assert get_next_anchor(RecurringInterval.month, after, anchor_day) == expected

    @pytest.mark.parametrize(
        ("after", "expected"),
        [
            (dt(2026, 3, 14, hour=23), dt(2026, 3, 15, hour=23)),
            (dt(2026, 3, 15, hour=0), dt(2026, 4, 15, hour=0)),
            (dt(2026, 3, 15, hour=23), dt(2026, 4, 15, hour=23)),
        ],
    )
    def test_month_strictly_after(self, after: datetime, expected: datetime) -> None:
        assert get_next_anchor(RecurringInterval.month, after, 15) == expected

    def test_preserves_time_and_timezone(self) -> None:
        after = datetime(2026, 3, 10, 8, 30, 15, 123, tzinfo=UTC)
        assert get_next_anchor(RecurringInterval.month, after, 31) == datetime(
            2026, 3, 31, 8, 30, 15, 123, tzinfo=UTC
        )

    @pytest.mark.parametrize(
        ("after", "anchor_month", "anchor_day", "expected"),
        [
            (dt(2026, 1, 10), 6, 15, dt(2026, 6, 15)),
            (dt(2026, 7, 10), 6, 15, dt(2027, 6, 15)),
            (dt(2026, 6, 15), 6, 15, dt(2027, 6, 15)),
            (dt(2026, 12, 31), 1, 1, dt(2027, 1, 1)),
            # Feb 29 only exists in leap years.
            (dt(2023, 3, 1), 2, 29, dt(2024, 2, 29)),
            (dt(2024, 2, 29), 2, 29, dt(2025, 2, 28)),
            (dt(2025, 2, 28), 2, 29, dt(2026, 2, 28)),
            (dt(2027, 3, 1), 2, 29, dt(2028, 2, 29)),
            (dt(2026, 5, 1), 4, 30, dt(2027, 4, 30)),
        ],
    )
    def test_year(
        self,
        after: datetime,
        anchor_month: int,
        anchor_day: int,
        expected: datetime,
    ) -> None:
        assert (
            get_next_anchor(RecurringInterval.year, after, anchor_day, anchor_month)
            == expected
        )

    @pytest.mark.parametrize(
        ("interval", "anchor_day", "anchor_month"),
        [
            (RecurringInterval.week, 0, None),
            (RecurringInterval.week, 8, None),
            (RecurringInterval.month, 0, None),
            (RecurringInterval.month, 32, None),
            (RecurringInterval.year, 15, None),
            (RecurringInterval.year, 15, 13),
            (RecurringInterval.year, 31, 4),
            (RecurringInterval.year, 30, 2),
        ],
    )
    def test_invalid_anchor(
        self,
        interval: RecurringInterval,
        anchor_day: int,
        anchor_month: int | None,
    ) -> None:
        with pytest.raises(ValueError, match="Invalid"):
            get_next_anchor(interval, dt(2026, 1, 1), anchor_day, anchor_month)

    @pytest.mark.parametrize(
        ("after", "anchor_day", "interval_count", "expected"),
        [
            (
                dt(2026, 1, 10),
                31,
                3,
                [dt(2026, 1, 31), dt(2026, 4, 30), dt(2026, 7, 31), dt(2026, 10, 31)],
            ),
            (
                dt(2025, 12, 1),
                29,
                2,
                [dt(2025, 12, 29), dt(2026, 2, 28), dt(2026, 4, 29), dt(2026, 6, 29)],
            ),
            (
                dt(2026, 1, 1),
                31,
                1,
                [dt(2026, 1, 31), dt(2026, 2, 28), dt(2026, 3, 31), dt(2026, 4, 30)],
            ),
        ],
    )
    def test_month_with_interval_count(
        self,
        after: datetime,
        anchor_day: int,
        interval_count: int,
        expected: list[datetime],
    ) -> None:
        interval = RecurringInterval.month
        periods = [get_next_anchor(interval, after, anchor_day)]
        while len(periods) < len(expected):
            periods.append(
                interval.get_next_period(periods[-1], anchor_day, interval_count)
            )
        assert periods == expected

    def test_year_with_interval_count(self) -> None:
        interval = RecurringInterval.year
        first = get_next_anchor(interval, dt(2023, 6, 1), 29, 2)
        assert first == dt(2024, 2, 29)
        second = interval.get_next_period(first, 29, 2)
        assert second == dt(2026, 2, 28)
        assert interval.get_next_period(second, 29, 2) == dt(2028, 2, 29)
