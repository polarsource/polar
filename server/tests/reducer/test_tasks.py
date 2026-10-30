import uuid

import pytest
from pytest_mock import MockerFixture

from polar.kit.utils import utc_now
from polar.meter.aggregation import AggregationFunction
from polar.models import CustomerMeter, Organization
from polar.postgres import AsyncSession
from polar.reducer.service import reducer as reducer_service
from polar.reducer.tasks import compare_highest_consumed_units, seal
from polar.worker._sqlalchemy import SQLAlchemyMiddleware
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


@pytest.mark.anyio
class TestCompareHighestConsumedUnits:
    async def test_compares_meters_per_aggregation_function(
        self, mocker: MockerFixture, session: AsyncSession
    ) -> None:
        customer_meters = [CustomerMeter(), CustomerMeter()]
        mocker.patch.object(
            SQLAlchemyMiddleware, "get_async_read_session", return_value=session
        )
        get_all = mocker.patch(
            "polar.reducer.tasks.CustomerMeterRepository"
            ".get_all_by_highest_consumed_units",
            return_value=customer_meters,
        )
        log_customer_meter_comparison = mocker.patch.object(
            reducer_service, "log_customer_meter_comparison"
        )

        await compare_highest_consumed_units()

        assert [call.args for call in get_all.call_args_list] == [
            (AggregationFunction.cnt, 10),
            (AggregationFunction.sum, 10),
            (AggregationFunction.max, 10),
            (AggregationFunction.min, 10),
            (AggregationFunction.avg, 10),
        ]
        assert [
            call.args[2] for call in log_customer_meter_comparison.call_args_list
        ] == customer_meters * 5


@pytest.mark.anyio
class TestSeal:
    async def test_deleted_customer(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        customer.set_deleted_at()
        await save_fixture(customer)
        mocker.patch.object(
            SQLAlchemyMiddleware, "get_async_session", return_value=session
        )
        seal_mock = mocker.patch.object(reducer_service, "seal")
        meter_id = uuid.uuid4()
        at = utc_now()

        await seal(customer.id, meter_id, at.isoformat())

        seal_mock.assert_awaited_once_with(session, customer, meter_id, at=at)
