from datetime import UTC, datetime

import pytest

from polar.kit.time_queries import TimeInterval
from polar.metrics.metrics import LTVMetric
from polar.metrics.schemas import MetricsPeriod


def _period(*, arpu: int, churn_rate: float, cost_per_user: float = 0) -> MetricsPeriod:
    return MetricsPeriod.model_validate(
        {
            "timestamp": datetime(2024, 1, 1, tzinfo=UTC),
            "average_revenue_per_user": arpu,
            "churn_rate": churn_rate,
            "cost_per_user": cost_per_user,
        }
    )


class TestLTVMetric:
    @pytest.mark.parametrize(
        "interval", [TimeInterval.day, TimeInterval.week, TimeInterval.month]
    )
    def test_monthly_churn_intervals(self, interval: TimeInterval) -> None:
        period = _period(arpu=50_00, churn_rate=0.05)

        assert LTVMetric.compute_from_period(period, interval) == 1000_00

    def test_yearly_converts_annual_churn_to_monthly(self) -> None:
        annual_churn = 1 - (1 - 0.05) ** 12
        period = _period(arpu=50_00, churn_rate=annual_churn)

        ltv = LTVMetric.compute_from_period(period, TimeInterval.year)

        assert ltv == pytest.approx(1000_00, abs=1)

    def test_yearly_full_churn(self) -> None:
        period = _period(arpu=50_00, churn_rate=1.2)

        assert LTVMetric.compute_from_period(period, TimeInterval.year) == 50_00

    @pytest.mark.parametrize(
        ("interval", "cost_per_user"),
        [
            (TimeInterval.day, 10_00 * 12 / 365.25),
            (TimeInterval.month, 10_00),
            (TimeInterval.year, 10_00 * 12),
        ],
    )
    def test_cost_per_user_normalized_to_monthly(
        self, interval: TimeInterval, cost_per_user: float
    ) -> None:
        churn_rate = 0.05
        if interval == TimeInterval.year:
            churn_rate = 1 - (1 - churn_rate) ** 12
        period = _period(arpu=50_00, churn_rate=churn_rate, cost_per_user=cost_per_user)

        ltv = LTVMetric.compute_from_period(period, interval)

        assert ltv == pytest.approx(800_00, abs=1)

    def test_zero_churn(self) -> None:
        period = _period(arpu=50_00, churn_rate=0)

        assert LTVMetric.compute_from_period(period, TimeInterval.month) == 0
