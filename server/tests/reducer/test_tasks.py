from datetime import UTC, datetime
from unittest.mock import ANY

import pytest
from pytest_mock import MockerFixture

from polar.billing_interval.service import billing_interval as billing_interval_service
from polar.models import Customer, Meter
from polar.reducer.service import reducer as reducer_service
from polar.reducer.tasks import seal


@pytest.mark.anyio
class TestSeal:
    async def test_splits_at_interval_boundaries_up_to_the_reset(
        self, mocker: MockerFixture, customer: Customer, meter: Meter
    ) -> None:
        seal_at = datetime(2026, 10, 7, 12, tzinfo=UTC)
        boundaries = (datetime(2026, 10, 7, 11, 30, tzinfo=UTC),)
        get_boundaries = mocker.patch.object(
            billing_interval_service, "get_boundaries", return_value=boundaries
        )
        reducer_seal = mocker.patch.object(reducer_service, "seal")

        await seal(customer.id, meter.id, seal_at.isoformat())

        get_boundaries.assert_awaited_once_with(ANY, customer, meter.id, until=seal_at)
        reducer_seal.assert_awaited_once_with(
            ANY, customer, meter.id, at=seal_at, boundaries=boundaries
        )
