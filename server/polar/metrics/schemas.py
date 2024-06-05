from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import create_model

from polar.kit.schemas import Schema

from .metrics import METRICS, MetricType


class Metric(Schema):
    slug: str
    display_name: str
    type: MetricType


if TYPE_CHECKING:

    class Metrics(Schema):
        def __getattr__(self, name: str) -> Metric: ...

else:
    Metrics = create_model(
        "Metrics", **{m.slug: (Metric, ...) for m in METRICS}, __base__=Schema
    )


class MetricsPeriodBase(Schema):
    timestamp: datetime


if TYPE_CHECKING:

    class MetricsPeriod(MetricsPeriodBase):
        def __getattr__(self, name: str) -> int: ...

else:
    MetricsPeriod = create_model(
        "MetricPeriod",
        **{m.slug: (int, ...) for m in METRICS},
        __base__=MetricsPeriodBase,
    )


class MetricsResponse(Schema):
    periods: list[MetricsPeriod]
    metrics: Metrics
