import dataclasses
import typing


@dataclasses.dataclass(kw_only=True)
class CustomerMeter:
    """Customer-wide usage and credits for a meter.

    Attributes:
        meter_id: Polar meter ID.
        consumed_units: Aggregated usage.
        credited_units: Units credited to the customer.
        balance: Credited units minus consumed units; may be negative.
        customer_id: Polar customer ID, when queried with it.
        external_customer_id: Application customer ID, when queried with it.
    """

    meter_id: str
    consumed_units: int | float
    credited_units: int | float
    balance: int | float
    customer_id: str | None = None
    external_customer_id: str | None = None


@typing.runtime_checkable
class MeterProtocol(typing.Protocol):
    async def meter(
        self,
        *,
        meter_id: str,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
    ) -> CustomerMeter | None: ...


@dataclasses.dataclass
class CustomerMeterList:
    items: list[CustomerMeter]
