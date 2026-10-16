import dataclasses
import typing


@dataclasses.dataclass(kw_only=True)
class CustomerMeter:
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
