import pytest
from pytest_mock import MockerFixture

from polar.meter.aggregation import AggregationFunction
from polar.models import CustomerMeter
from polar.postgres import AsyncSession
from polar.reducer.service import reducer as reducer_service
from polar.reducer.tasks import compare_highest_consumed_units
from polar.worker._sqlalchemy import SQLAlchemyMiddleware


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
