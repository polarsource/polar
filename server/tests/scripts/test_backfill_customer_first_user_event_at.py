import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.integrations.tinybird.service import (
    event_types_by_customer_id_table,
    event_types_by_external_customer_id_table,
)
from polar.kit.db.postgres import AsyncSession
from polar.models import Customer, Organization
from scripts.backfill_customer_first_user_event_at import (
    _pages_by_key,
    backfill_organization,
)
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
) -> AsyncMock:
    """One short page per view, so each read stops after a single query."""
    return mocker.patch(
        "scripts.backfill_customer_first_user_event_at.tinybird_client.query",
        new_callable=AsyncMock,
        side_effect=[
            [
                {"customer_id": str(key), "first_seen": value}
                for key, value in by_customer_id.items()
            ],
            [
                {"external_customer_id": key, "first_seen": value}
                for key, value in by_external_customer_id.items()
            ],
        ],
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

        # Written once per view; the repository guard keeps the earlier value.
        assert count == 2
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


@pytest.mark.asyncio
class TestPagesByKey:
    async def test_pages_the_customer_id_view(self, mocker: MockerFixture) -> None:
        mocker.patch("scripts.backfill_customer_first_user_event_at.PAGE_SIZE", 2)
        customer_ids = [uuid.uuid4() for _ in range(3)]
        timestamp = datetime(2020, 1, 1, tzinfo=UTC)
        query_mock = mocker.patch(
            "scripts.backfill_customer_first_user_event_at.tinybird_client.query",
            new_callable=AsyncMock,
            side_effect=[
                [
                    {"customer_id": str(id), "first_seen": timestamp}
                    for id in customer_ids[:2]
                ],
                [{"customer_id": str(customer_ids[2]), "first_seen": timestamp}],
            ],
        )

        pages = [
            page
            async for page in _pages_by_key(
                event_types_by_customer_id_table,
                "customer_id",
                uuid.uuid4(),
                uuid_key=True,
            )
        ]

        assert [len(page) for page in pages] == [2, 1]
        # The second page resumes after the last key of the first, cast so
        # ClickHouse compares UUIDs rather than a UUID against a string.
        second_call = query_mock.await_args_list[1]
        assert "`customer_id` > toUUID(" in second_call.args[0]
        assert str(customer_ids[1]) in second_call.kwargs["parameters"].values()

    async def test_pages_the_external_customer_id_view(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch("scripts.backfill_customer_first_user_event_at.PAGE_SIZE", 2)
        timestamp = datetime(2020, 1, 1, tzinfo=UTC)
        query_mock = mocker.patch(
            "scripts.backfill_customer_first_user_event_at.tinybird_client.query",
            new_callable=AsyncMock,
            side_effect=[
                [
                    {"external_customer_id": key, "first_seen": timestamp}
                    for key in ("EXT_1", "EXT_2")
                ],
                [{"external_customer_id": "EXT_3", "first_seen": timestamp}],
            ],
        )

        pages = [
            page
            async for page in _pages_by_key(
                event_types_by_external_customer_id_table,
                "external_customer_id",
                uuid.uuid4(),
                uuid_key=False,
            )
        ]

        assert [len(page) for page in pages] == [2, 1]
        # This view keys on a String, so the cursor is bound directly rather than
        # wrapped in the toUUID() cast the customer id view needs.
        second_call = query_mock.await_args_list[1]
        assert "`external_customer_id` > {" in second_call.args[0]
        assert "EXT_2" in second_call.kwargs["parameters"].values()

    async def test_no_rows(self, mocker: MockerFixture) -> None:
        mocker.patch(
            "scripts.backfill_customer_first_user_event_at.tinybird_client.query",
            new_callable=AsyncMock,
            return_value=[],
        )

        pages = [
            page
            async for page in _pages_by_key(
                event_types_by_customer_id_table,
                "customer_id",
                uuid.uuid4(),
                uuid_key=True,
            )
        ]

        assert pages == []
