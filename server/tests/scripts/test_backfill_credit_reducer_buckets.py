from datetime import timedelta
from decimal import Decimal

import pytest
from pytest_mock import MockerFixture

from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Customer, CustomerMeter, Meter, Organization, ReducerBucket
from polar.models.reducer import ReducerKind
from scripts.backfill_credit_reducer_buckets import backfill_batch
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_reducer


@pytest.mark.anyio
class TestBackfillCreditReducerBuckets:
    @pytest.mark.parametrize(
        ("credited_units", "with_credit_bucket", "rebuilt"),
        [
            (10, False, True),
            (0, True, True),
            (0, False, False),
        ],
    )
    async def test_customer_meters_with_credits_or_credit_buckets(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
        credited_units: int,
        with_credit_bucket: bool,
        rebuilt: bool,
    ) -> None:
        sync_credits = mocker.patch(
            "scripts.backfill_credit_reducer_buckets.reducer_service.sync_credits"
        )
        customer_meter = CustomerMeter(
            customer=customer,
            meter=meter,
            consumed_units=Decimal(0),
            credited_units=credited_units,
            balance=Decimal(credited_units),
        )
        await save_fixture(customer_meter)
        reducer = await create_reducer(
            save_fixture,
            organization=organization,
            meters=[meter],
            kind=ReducerKind.credit,
        )
        if with_credit_bucket:
            now = utc_now()
            await save_fixture(
                ReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    customer=customer,
                    bucket_start=now,
                    bucket_end=now + timedelta(minutes=5),
                    count=1,
                    sum=Decimal(-10),
                )
            )

        last = await backfill_batch(session, after=None, batch_size=10)

        if rebuilt:
            assert last == customer_meter.id
            sync_credits.assert_called_once_with(session, customer, meter.id)
        else:
            assert last is None
            sync_credits.assert_not_called()

    async def test_only_given_customer_meters(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        customer_second: Customer,
        meter: Meter,
    ) -> None:
        sync_credits = mocker.patch(
            "scripts.backfill_credit_reducer_buckets.reducer_service.sync_credits"
        )
        customer_meters = [
            CustomerMeter(
                customer=c,
                meter=meter,
                consumed_units=Decimal(0),
                credited_units=10,
                balance=Decimal(10),
            )
            for c in (customer, customer_second)
        ]
        for customer_meter in customer_meters:
            await save_fixture(customer_meter)

        last = await backfill_batch(
            session,
            after=None,
            batch_size=10,
            customer_meter_ids=[customer_meters[1].id],
        )

        assert last == customer_meters[1].id
        sync_credits.assert_called_once_with(session, customer_second, meter.id)
