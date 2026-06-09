import logging
from typing import Any

from polar.kit.metadata import get_nested_metadata_value
from polar.meter.aggregation import (
    Aggregation,
    AggregationTypeAdapter,
    CountAggregation,
)
from polar.meter.event import BufferedEvent
from polar.meter.filter import Filter
from polar.repository import EventRepository

log = logging.getLogger("polar.sidecar.customer_meter")


async def merge_customer_meter(
    repository: EventRepository, customer_meter: dict[str, Any]
) -> dict[str, Any]:
    """Add the locally-buffered delta into an upstream customer meter response.

    Falls back to the upstream values on any error: a stale-but-true balance beats a
    wrong one, and one bad meter must not break the whole response.
    """
    try:
        return await _merge(repository, customer_meter)
    except Exception:
        log.exception(
            "failed to merge customer meter %s; serving upstream",
            customer_meter.get("id"),
        )
        return customer_meter


async def _merge(
    repository: EventRepository, customer_meter: dict[str, Any]
) -> dict[str, Any]:
    meter = customer_meter["meter"]
    aggregation = AggregationTypeAdapter.validate_python(meter["aggregation"])
    if not aggregation.is_summable():
        return customer_meter

    last_balanced_event_id = customer_meter["last_balanced_event_id"]
    if last_balanced_event_id is not None:
        watermark = await repository.get_local_id_for_polar_event(
            last_balanced_event_id
        )
        if watermark is None:
            log.warning(
                "watermark %s not buffered locally; serving upstream customer meter %s",
                last_balanced_event_id,
                customer_meter["id"],
            )
            return customer_meter
    else:
        watermark = None

    customer = customer_meter["customer"]
    events = await repository.get_customer_delta_events(
        customer_id=customer["id"],
        external_customer_id=customer.get("external_id"),
        watermark_local_id=watermark,
    )

    filter = Filter.model_validate(meter["filter"])
    delta = 0.0
    for event in events:
        buffered = BufferedEvent.from_body(event.body)
        if filter.matches(buffered) and aggregation.matches(buffered):
            delta += _contribution(aggregation, buffered)

    if delta == 0.0:
        return customer_meter

    consumed = float(customer_meter["consumed_units"]) + delta
    credited = float(customer_meter["credited_units"])
    return {
        **customer_meter,
        "consumed_units": consumed,
        "balance": credited - consumed,
    }


def _contribution(aggregation: Aggregation, event: BufferedEvent) -> float:
    if isinstance(aggregation, CountAggregation):
        return 1.0
    value = get_nested_metadata_value(event.user_metadata, aggregation.property)
    if isinstance(value, bool) or not isinstance(value, int | float):
        return 0.0
    return float(value)
