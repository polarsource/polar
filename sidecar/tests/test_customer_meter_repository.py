from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from polar.models import CustomerMeter
from polar.repository import CustomerMeterRepository


def _customer_meter(
    id: str = "cm_1",
    *,
    customer_id: str = "cus_uuid",
    meter_id: str = "meter_uuid",
    consumed_units: float = 5.0,
    balance: float = 95.0,
) -> CustomerMeter:
    return CustomerMeter(
        id=id,
        customer_id=customer_id,
        meter_id=meter_id,
        external_customer_id="cus_1",
        filter={"conjunction": "and", "clauses": []},
        aggregation={"func": "count"},
        consumed_units=consumed_units,
        credited_units=100,
        balance=balance,
        last_balanced_event_id="polar_w",
        snapshot={"id": id, "consumed_units": consumed_units, "balance": balance},
        polled_at=datetime(2026, 6, 9, 10, 0, tzinfo=UTC),
    )


@pytest.mark.asyncio
async def test_upsert_inserts(session: AsyncSession) -> None:
    repository = CustomerMeterRepository(session)
    await repository.upsert(_customer_meter())
    await session.flush()

    fetched = await repository.get_by_id("cm_1")
    assert fetched is not None
    assert fetched.consumed_units == 5.0
    assert fetched.snapshot == {"id": "cm_1", "consumed_units": 5.0, "balance": 95.0}


@pytest.mark.asyncio
async def test_upsert_updates_existing(session: AsyncSession) -> None:
    repository = CustomerMeterRepository(session)
    await repository.upsert(_customer_meter(consumed_units=5.0, balance=95.0))
    await repository.upsert(_customer_meter(consumed_units=20.0, balance=80.0))
    await session.flush()

    fetched = await repository.get_by_id("cm_1")
    assert fetched is not None
    assert fetched.consumed_units == 20.0
    assert fetched.balance == 80.0
    assert fetched.snapshot["consumed_units"] == 20.0


@pytest.mark.asyncio
async def test_get_by_customer_id(session: AsyncSession) -> None:
    repository = CustomerMeterRepository(session)
    await repository.upsert(_customer_meter(id="cm_1", meter_id="m1"))
    await repository.upsert(_customer_meter(id="cm_2", meter_id="m2"))
    await repository.upsert(
        _customer_meter(id="cm_3", customer_id="other_cus", meter_id="m1")
    )
    await session.flush()

    meters = await repository.get_by_customer_id("cus_uuid")
    assert {meter.id for meter in meters} == {"cm_1", "cm_2"}


@pytest.mark.asyncio
async def test_get_by_id_missing(session: AsyncSession) -> None:
    repository = CustomerMeterRepository(session)
    assert await repository.get_by_id("nope") is None
