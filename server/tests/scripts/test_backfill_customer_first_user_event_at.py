from datetime import UTC, datetime

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.models import Customer, Organization
from scripts.backfill_customer_first_user_event_at import backfill_organization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


async def _get_first_user_event_at(
    session: AsyncSession, customer: Customer
) -> datetime | None:
    result = await session.execute(
        select(Customer.first_user_event_at).where(Customer.id == customer.id)
    )
    return result.scalar_one()


def _mock_views(
    mocker: MockerFixture,
    by_customer_id: dict[object, datetime],
    by_external_customer_id: dict[str, datetime],
) -> None:
    mocker.patch(
        "scripts.backfill_customer_first_user_event_at."
        "tinybird_service.get_first_user_event_at_by_organization",
        return_value=(by_customer_id, by_external_customer_id),
    )


@pytest.mark.asyncio
class TestBackfillOrganization:
    async def test_by_customer_id(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        first_user_event_at = datetime(2020, 1, 1, tzinfo=UTC)
        _mock_views(mocker, {customer.id: first_user_event_at}, {})

        count = await backfill_organization(session, organization.id, execute=True)

        assert count == 1
        assert await _get_first_user_event_at(session, customer) == first_user_event_at

    async def test_by_external_customer_id(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, external_id="EXTERNAL_ID"
        )
        first_user_event_at = datetime(2020, 1, 1, tzinfo=UTC)
        _mock_views(mocker, {}, {"EXTERNAL_ID": first_user_event_at})

        count = await backfill_organization(session, organization.id, execute=True)

        assert count == 1
        assert await _get_first_user_event_at(session, customer) == first_user_event_at

    async def test_keeps_the_earlier_of_both_views(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, external_id="EXTERNAL_ID"
        )
        earliest = datetime(2019, 1, 1, tzinfo=UTC)
        _mock_views(
            mocker,
            {customer.id: datetime(2021, 1, 1, tzinfo=UTC)},
            {"EXTERNAL_ID": earliest},
        )

        count = await backfill_organization(session, organization.id, execute=True)

        assert count == 1
        assert await _get_first_user_event_at(session, customer) == earliest

    async def test_unknown_external_customer_id_is_skipped(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        _mock_views(mocker, {}, {"NEVER_A_CUSTOMER": datetime(2020, 1, 1, tzinfo=UTC)})

        count = await backfill_organization(session, organization.id, execute=True)

        assert count == 0

    async def test_dry_run_writes_nothing(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        _mock_views(mocker, {customer.id: datetime(2020, 1, 1, tzinfo=UTC)}, {})

        count = await backfill_organization(session, organization.id, execute=False)

        assert count == 1
        assert await _get_first_user_event_at(session, customer) is None
