from datetime import UTC, datetime
from decimal import Decimal

from polar.feature_breakdown.service import _buckets, _recognize
from polar.integrations.tinybird.service import TinybirdCustomerOrder
from polar.kit.time_queries import TimeInterval

START = datetime(2026, 3, 1, tzinfo=UTC)
END = datetime(2026, 6, 1, tzinfo=UTC)
BUCKETS = _buckets(START, END, TimeInterval.month)


def _order(
    timestamp: datetime,
    amount: int,
    recurring_interval: str | None = None,
    recurring_interval_count: int | None = None,
) -> TinybirdCustomerOrder:
    return TinybirdCustomerOrder(
        customer_id=None,
        external_customer_id="customer",
        product_id=None,
        timestamp=timestamp,
        amount=amount,
        recurring_interval=recurring_interval,
        recurring_interval_count=recurring_interval_count,
    )


class TestRecognize:
    def test_one_time_in_window(self) -> None:
        order = _order(datetime(2026, 4, 15, tzinfo=UTC), 1000)

        assert _recognize(order, START, END, BUCKETS) == [
            (datetime(2026, 4, 1, tzinfo=UTC), Decimal(1000))
        ]

    def test_one_time_outside_window(self) -> None:
        order = _order(datetime(2026, 2, 15, tzinfo=UTC), 1000)

        assert _recognize(order, START, END, BUCKETS) == []

    def test_monthly_within_one_bucket(self) -> None:
        order = _order(datetime(2026, 4, 1, tzinfo=UTC), 3000, "month", 1)

        assert _recognize(order, START, END, BUCKETS) == [
            (datetime(2026, 4, 1, tzinfo=UTC), Decimal(3000))
        ]

    def test_yearly_paid_before_window(self) -> None:
        order = _order(datetime(2026, 1, 1, tzinfo=UTC), 36500, "year", 1)

        recognized = dict(_recognize(order, START, END, BUCKETS))

        assert set(recognized) == set(BUCKETS)
        assert round(recognized[datetime(2026, 3, 1, tzinfo=UTC)]) == 3100
        assert round(recognized[datetime(2026, 4, 1, tzinfo=UTC)]) == 3000
        assert round(sum(recognized.values())) == 9200

    def test_period_ending_mid_window(self) -> None:
        order = _order(datetime(2026, 2, 15, tzinfo=UTC), 2800, "month", 1)

        recognized = _recognize(order, START, END, BUCKETS)

        assert len(recognized) == 1
        assert recognized[0][0] == datetime(2026, 3, 1, tzinfo=UTC)
        assert round(recognized[0][1]) == 1400

    def test_refund(self) -> None:
        order = _order(datetime(2026, 5, 2, tzinfo=UTC), -500)

        assert _recognize(order, START, END, BUCKETS) == [
            (datetime(2026, 5, 1, tzinfo=UTC), Decimal(-500))
        ]
