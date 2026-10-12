from datetime import UTC, datetime

import pytest
from pytest_mock import MockerFixture

from polar.models import Customer, Meter, Organization
from polar.postgres import AsyncSession
from polar.reducer.service import reducer as reducer_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_reducer

START = datetime(2026, 10, 1, tzinfo=UTC)
CUTOFF = datetime(2026, 10, 7, 12, 7, tzinfo=UTC)


@pytest.mark.anyio
class TestSeal:
    async def test_seals_the_meters_reducers(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        seal = mocker.patch("polar.reducer.service.reducer_bucket_service.seal")

        await reducer_service.seal(
            session, customer, [meter.id], start=START, cutoff=CUTOFF
        )

        seal.assert_called_once_with(
            session, [reducer], customer, start=START, cutoff=CUTOFF
        )

    async def test_logs_failures_without_raising(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        await create_reducer(save_fixture, organization=organization, meters=[meter])
        mocker.patch(
            "polar.reducer.service.reducer_bucket_service.seal",
            side_effect=RuntimeError,
        )

        await reducer_service.seal(
            session, customer, [meter.id], start=START, cutoff=CUTOFF
        )

        assert await session.get(Meter, meter.id) is not None
