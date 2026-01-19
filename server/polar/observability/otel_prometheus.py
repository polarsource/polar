"""
Simple OpenTelemetry MeterProvider that bridges to prometheus_client.

Supports multiprocess mode via prometheus_client's PROMETHEUS_MULTIPROC_DIR.
"""

from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING, Any

from opentelemetry.metrics import (
    CallbackT,
    Counter,
    Histogram,
    Meter,
    MeterProvider,
    ObservableCounter,
    ObservableGauge,
    ObservableUpDownCounter,
    UpDownCounter,
)
from opentelemetry.metrics import _Gauge as Gauge
from prometheus_client import Gauge as PromGauge

import polar.observability.metrics  # noqa: F401  # Sets PROMETHEUS_MULTIPROC_DIR

if TYPE_CHECKING:
    from opentelemetry.context import Context

type Attributes = (
    Mapping[
        str,
        str
        | bool
        | int
        | float
        | Sequence[str]
        | Sequence[bool]
        | Sequence[int]
        | Sequence[float],
    ]
    | None
)


class PrometheusUpDownCounter(UpDownCounter):
    def __init__(self, name: str, unit: str, description: str) -> None:
        prom_name = name.replace(".", "_")
        self._gauge = PromGauge(
            prom_name,
            description,
            ["service", "state"],
            multiprocess_mode="livesum",
        )

    def add(
        self,
        amount: int | float,
        attributes: Attributes = None,
        context: "Context | None" = None,
    ) -> None:
        labels = self._extract_labels(attributes)
        self._gauge.labels(**labels).inc(amount)

    def _extract_labels(self, attributes: Attributes) -> dict[str, str]:
        if not attributes:
            return {"service": "unknown", "state": "unknown"}
        return {
            "service": str(attributes.get("pool.name", "unknown")),
            "state": str(attributes.get("state", "unknown")),
        }


class PrometheusMeter(Meter):
    def __init__(self, name: str, version: str | None, schema_url: str | None) -> None:
        self._name = name
        self._version = version
        self._schema_url = schema_url
        self._instruments: dict[str, Any] = {}

    @property
    def name(self) -> str:
        return self._name

    @property
    def version(self) -> str | None:
        return self._version

    @property
    def schema_url(self) -> str | None:
        return self._schema_url

    def create_up_down_counter(
        self,
        name: str,
        unit: str = "",
        description: str = "",
    ) -> UpDownCounter:
        if name not in self._instruments:
            self._instruments[name] = PrometheusUpDownCounter(name, unit, description)
        return self._instruments[name]

    def create_counter(
        self,
        name: str,
        unit: str = "",
        description: str = "",
    ) -> Counter:
        raise NotImplementedError

    def create_histogram(
        self,
        name: str,
        unit: str = "",
        description: str = "",
        *,
        explicit_bucket_boundaries_advisory: Sequence[float] | None = None,
    ) -> Histogram:
        raise NotImplementedError

    def create_gauge(
        self,
        name: str,
        unit: str = "",
        description: str = "",
    ) -> Gauge:
        raise NotImplementedError

    def create_observable_counter(
        self,
        name: str,
        callbacks: Sequence[CallbackT] | None = None,
        unit: str = "",
        description: str = "",
    ) -> ObservableCounter:
        raise NotImplementedError

    def create_observable_up_down_counter(
        self,
        name: str,
        callbacks: Sequence[CallbackT] | None = None,
        unit: str = "",
        description: str = "",
    ) -> ObservableUpDownCounter:
        raise NotImplementedError

    def create_observable_gauge(
        self,
        name: str,
        callbacks: Sequence[CallbackT] | None = None,
        unit: str = "",
        description: str = "",
    ) -> ObservableGauge:
        raise NotImplementedError


class PrometheusMeterProvider(MeterProvider):
    def __init__(self) -> None:
        self._meters: dict[str, PrometheusMeter] = {}

    def get_meter(
        self,
        name: str,
        version: str | None = None,
        schema_url: str | None = None,
        attributes: Attributes = None,
    ) -> Meter:
        key = f"{name}:{version}:{schema_url}"
        if key not in self._meters:
            self._meters[key] = PrometheusMeter(name, version, schema_url)
        return self._meters[key]
