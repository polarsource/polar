from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.models import Customer, Organization, Payment, Product
from polar.models.payment import PaymentStatus
from scripts.backfill_pending_intent_race_payments import _duplicates_where
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order, create_payment, create_refund

SINCE = datetime(2026, 7, 22, 9, 0, tzinfo=UTC)

INTENT_ID = "pi_RACE"
CHARGE_ID = "ch_RACE"


async def _duplicate_ids(session: AsyncSession) -> list[Payment]:
    statement = select(Payment).where(*_duplicates_where(SINCE))
    return list((await session.execute(statement)).scalars().all())


async def _intent_payment(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    intent_id: str = INTENT_ID,
    status: PaymentStatus = PaymentStatus.pending,
) -> Payment:
    return await create_payment(
        save_fixture,
        organization,
        status=status,
        method="unknown",
        processor_id=intent_id,
        processor_metadata={"payment_intent_id": intent_id},
    )


async def _charge_payment(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    intent_id: str = INTENT_ID,
) -> Payment:
    return await create_payment(
        save_fixture,
        organization,
        processor_id=CHARGE_ID,
        processor_metadata={"payment_intent_id": intent_id},
    )


@pytest.mark.asyncio
class TestDuplicatesWhere:
    async def test_selects_the_intent_row_beside_its_charge(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        intent = await _intent_payment(save_fixture, organization)
        charge = await _charge_payment(save_fixture, organization)

        duplicates = await _duplicate_ids(session)

        assert [payment.id for payment in duplicates] == [intent.id]
        assert charge.id not in {payment.id for payment in duplicates}

    async def test_keeps_an_intent_row_without_a_charge(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """A genuine requires_action record: the wedge case the recorder exists for."""
        await _intent_payment(save_fixture, organization)

        assert await _duplicate_ids(session) == []

    async def test_keeps_an_intent_row_promoted_onto_its_charge(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await create_payment(
            save_fixture,
            organization,
            processor_id=CHARGE_ID,
            processor_metadata={"payment_intent_id": INTENT_ID},
        )

        assert await _duplicate_ids(session) == []

    async def test_keeps_a_resolved_intent_row(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await _intent_payment(save_fixture, organization, status=PaymentStatus.failed)
        await _charge_payment(save_fixture, organization)

        assert await _duplicate_ids(session) == []

    async def test_keeps_an_intent_row_for_a_different_intent(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await _intent_payment(save_fixture, organization)
        await _charge_payment(save_fixture, organization, intent_id="pi_OTHER")

        assert await _duplicate_ids(session) == []

    async def test_keeps_a_legacy_intent_row_without_metadata(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """The failure path keys on the intent too, but records no metadata."""
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.pending,
            processor_id=INTENT_ID,
        )
        await _charge_payment(save_fixture, organization)

        assert await _duplicate_ids(session) == []

    async def test_keeps_a_row_predating_the_deploy(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        intent = await _intent_payment(save_fixture, organization)
        await _charge_payment(save_fixture, organization)
        intent.created_at = datetime(2026, 7, 21, tzinfo=UTC)
        await save_fixture(intent)

        assert await _duplicate_ids(session) == []

    async def test_keeps_a_row_whose_charge_is_soft_deleted(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await _intent_payment(save_fixture, organization)
        charge = await _charge_payment(save_fixture, organization)
        charge.set_deleted_at()
        await save_fixture(charge)

        assert await _duplicate_ids(session) == []

    async def test_keeps_a_referenced_row(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        """Soft-deleting a refunded payment would orphan the refund."""
        intent = await _intent_payment(save_fixture, organization)
        await _charge_payment(save_fixture, organization)
        order = await create_order(save_fixture, product=product, customer=customer)
        await create_refund(save_fixture, order, intent)

        assert await _duplicate_ids(session) == []
