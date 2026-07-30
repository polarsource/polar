import pytest
import sqlalchemy as sa
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Customer, Organization
from scripts.backfill_customer_deleted_external_id import run_backfill
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


async def _delete_keeping_external_id(
    session: AsyncSession, customer: Customer
) -> None:
    """Reproduce a pre-fix anonymized delete: deleted_at set, external_id kept."""
    await session.execute(
        sa.update(Customer)
        .where(Customer.id == customer.id)
        .values(deleted_at=utc_now())
    )


async def _get_customer_row(
    session: AsyncSession, customer: Customer
) -> sa.Row[tuple[str | None, dict[str, str]]]:
    result = await session.execute(
        select(Customer.external_id, Customer.user_metadata).where(
            Customer.id == customer.id
        )
    )
    return result.one()


@pytest.mark.asyncio
class TestBackfillCustomerDeletedExternalId:
    async def test_frees_external_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="stuck@example.com",
            external_id="stuck-external-id",
            user_metadata={"user_id": "ABC"},
        )
        await _delete_keeping_external_id(session, customer)

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 1
        row = await _get_customer_row(session, customer)
        assert row.external_id is None
        assert row.user_metadata["__external_id"] == "stuck-external-id"
        assert row.user_metadata["user_id"] == "ABC"

    async def test_freed_external_id_is_reusable(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="stuck@example.com",
            external_id="stuck-external-id",
        )
        await _delete_keeping_external_id(session, customer)

        await run_backfill(batch_size=10, session=session)

        recycled = await create_customer(
            save_fixture,
            organization=organization,
            email="recycled@example.com",
            external_id="stuck-external-id",
        )
        assert recycled.id != customer.id
        assert recycled.external_id == "stuck-external-id"

    async def test_ignores_live_customers(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="live@example.com",
            external_id="live-external-id",
        )

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 0
        row = await _get_customer_row(session, customer)
        assert row.external_id == "live-external-id"

    async def test_is_idempotent(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="stuck@example.com",
            external_id="stuck-external-id",
        )
        await _delete_keeping_external_id(session, customer)

        first_run = await run_backfill(batch_size=10, session=session)
        second_run = await run_backfill(batch_size=10, session=session)

        assert first_run == 1
        assert second_run == 0
        row = await _get_customer_row(session, customer)
        assert row.user_metadata["__external_id"] == "stuck-external-id"

    async def test_batches_across_multiple_rows(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        for index in range(5):
            customer = await create_customer(
                save_fixture,
                organization=organization,
                email=f"stuck-{index}@example.com",
                external_id=f"stuck-external-id-{index}",
            )
            await _delete_keeping_external_id(session, customer)

        updated = await run_backfill(batch_size=2, session=session)

        assert updated == 5
        remaining = await session.execute(
            select(sa.func.count())
            .select_from(Customer)
            .where(Customer.deleted_at.is_not(None), Customer.external_id.is_not(None))
        )
        assert remaining.scalar_one() == 0
